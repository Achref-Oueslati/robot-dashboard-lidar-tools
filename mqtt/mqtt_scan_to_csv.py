#!/usr/bin/env python3
"""
mqtt_scan_to_csv.py

Pure-Python (no ROS required) MQTT -> parse ROS2 CDR-serialized sensor_msgs/LaserScan
and export rows:
    timestamp(ms),frameIndex,pointIndex,angleDeg,range,x,y

Each time you run the script it will create a new CSV file with an incrementing suffix:
  mqtt_laserscan_0.csv, mqtt_laserscan_1.csv, ...

Usage:
    pip install paho-mqtt
    python3 mqtt_scan_to_csv.py --host mqtt-broker.local --port 1888 --topic MQTT/scan --out mqtt_laserscan.csv
"""
import argparse
import csv
import math
import os
import re
import struct
import sys
import time
from threading import Event

try:
    import paho.mqtt.client as mqtt
except Exception:
    print("Install paho-mqtt: pip install paho-mqtt")
    sys.exit(1)


# ---------- helper to pick next filename ----------
def next_out_path(out_path):
    """
    Given e.g. "mqtt_laserscan.csv" or "data/my_scans.csv",
    return next filename with suffix _N.csv where N increases:
      mqtt_laserscan_0.csv, mqtt_laserscan_1.csv, ...
    """
    out_dir, out_fname = os.path.split(out_path)
    if not out_dir:
        out_dir = '.'
    if out_fname.lower().endswith('.csv'):
        base = out_fname[:-4]
    else:
        base = out_fname

    # pattern looks like base_N.csv
    pat = re.compile(re.escape(base) + r'_(\d+)\.csv$')
    maxn = -1
    try:
        for f in os.listdir(out_dir):
            m = pat.match(f)
            if m:
                try:
                    n = int(m.group(1))
                    if n > maxn:
                        maxn = n
                except Exception:
                    pass
    except FileNotFoundError:
        # directory doesn't exist yet; we'll create it
        pass
    nextn = maxn + 1
    new_fname = f"{base}_{nextn}.csv"
    return os.path.join(out_dir, new_fname)


# ---------------- CDR helpers ----------------
def align(idx, align_bytes):
    return ((idx + (align_bytes - 1)) // align_bytes) * align_bytes


def read_uint32_le(data, idx):
    return struct.unpack_from('<I', data, idx)[0], idx + 4


def read_int32_le(data, idx):
    return struct.unpack_from('<i', data, idx)[0], idx + 4


def read_float32_le(data, idx):
    return struct.unpack_from('<f', data, idx)[0], idx + 4


def read_string_cdr(data, idx):
    idx = align(idx, 4)
    if idx + 4 > len(data):
        raise ValueError("not enough bytes for string length")
    length, idx = read_uint32_le(data, idx)
    if idx + length > len(data):
        raise ValueError("not enough bytes for string content")
    s = data[idx: idx + length].decode('utf-8', errors='replace')
    idx += length
    idx = align(idx, 4)
    return s, idx


def try_parse_laserscan_from(data, offset=0):
    idx = offset
    if idx >= len(data):
        raise ValueError("offset beyond payload")

    idx = align(idx, 4)
    if idx + 4 > len(data):
        raise ValueError("no room for header.seq")
    seq, idx = read_uint32_le(data, idx)

    idx = align(idx, 4)
    if idx + 8 > len(data):
        raise ValueError("no room for header.stamp")
    sec, idx = read_int32_le(data, idx)
    nanosec, idx = read_uint32_le(data, idx)

    frame_id, idx = read_string_cdr(data, idx)

    idx = align(idx, 4)
    needed = 7 * 4
    if idx + needed > len(data):
        raise ValueError("not enough bytes for float fields")
    angle_min, idx = read_float32_le(data, idx)
    angle_max, idx = read_float32_le(data, idx)
    angle_increment, idx = read_float32_le(data, idx)
    time_increment, idx = read_float32_le(data, idx)
    scan_time, idx = read_float32_le(data, idx)
    range_min, idx = read_float32_le(data, idx)
    range_max, idx = read_float32_le(data, idx)

    idx = align(idx, 4)
    if idx + 4 > len(data):
        raise ValueError("no room for ranges length")
    ranges_len, idx = read_uint32_le(data, idx)
    if ranges_len < 0 or ranges_len > 2000000:
        raise ValueError(f"unreasonable ranges length: {ranges_len}")

    bytes_needed = ranges_len * 4
    if idx + bytes_needed > len(data):
        raise ValueError("not enough bytes for ranges data")
    ranges = []
    if ranges_len:
        fmt = '<' + ('f' * ranges_len)
        ranges = list(struct.unpack_from(fmt, data, idx))
    idx += bytes_needed

    # Try skip intensities sequence if present (best-effort)
    try:
        idx = align(idx, 4)
        if idx + 4 <= len(data):
            intens_len, tmp_idx = read_uint32_le(data, idx)
            if 0 <= intens_len <= 200000:
                idx = tmp_idx + intens_len * 4
    except Exception:
        pass

    return {
        'seq': seq,
        'stamp_sec': sec,
        'stamp_nanosec': nanosec,
        'frame_id': frame_id,
        'angle_min': float(angle_min),
        'angle_max': float(angle_max),
        'angle_increment': float(angle_increment),
        'time_increment': float(time_increment),
        'scan_time': float(scan_time),
        'range_min': float(range_min),
        'range_max': float(range_max),
        'ranges': ranges,
    }


def validate_parsed(p):
    ai = p['angle_increment']
    if not math.isfinite(ai) or not (1e-6 <= abs(ai) <= 1.0):
        return False
    if not (math.isfinite(p['angle_min']) and math.isfinite(p['angle_max'])):
        return False
    if not (-10.0 <= p['angle_min'] <= 10.0 and -10.0 <= p['angle_max'] <= 10.0):
        return False
    if not (math.isfinite(p['range_min']) and math.isfinite(p['range_max'])):
        return False
    if not (0.0 <= p['range_min'] < p['range_max'] <= 1000.0):
        return False
    rlen = len(p['ranges'])
    if not (1 <= rlen <= 200000):
        return False
    expected = int(round(abs((p['angle_max'] - p['angle_min']) / (p['angle_increment'] if p['angle_increment'] != 0 else 1))))
    if expected > 0 and not (expected // 4 <= rlen <= expected * 4):
        return False
    return True


# ---------------- MQTT collector ----------------
class MQTTCollector:
    def __init__(self, host, port, topic, out_csv, raw_dump_dir=None, use_header_stamp=True, verbose=True, prefer_header_seq=False):
        self.host = host
        self.port = port
        self.topic = topic
        self.out_csv = out_csv
        self.raw_dump_dir = raw_dump_dir
        self.use_header_stamp = use_header_stamp
        self.verbose = verbose
        self.prefer_header_seq = prefer_header_seq

        self.client = mqtt.Client()
        self.client.on_connect = self._on_connect
        self.client.on_message = self._on_message

        self.frame_counter = 0
        self.last_seq = None
        self.shutdown = Event()

        self.csv_fp = None
        self.csv_writer = None
        # open CSV (out_csv already points to the next unique filename)
        self._open_csv()

    def _open_csv(self):
        os.makedirs(os.path.dirname(self.out_csv) or ".", exist_ok=True)
        newfile = not os.path.exists(self.out_csv)
        self.csv_fp = open(self.out_csv, 'a', newline='')
        self.csv_writer = csv.writer(self.csv_fp)
        if newfile:
            self.csv_writer.writerow(['timestamp', 'frameIndex', 'pointIndex', 'angleDeg', 'range', 'x', 'y'])
            self.csv_fp.flush()

    def close(self):
        try:
            if self.csv_fp:
                self.csv_fp.flush()
                self.csv_fp.close()
        except Exception:
            pass

    def _on_connect(self, client, userdata, flags, rc):
        print(f"[mqtt] connected rc={rc}, subscribing {self.topic}")
        self.client.subscribe(self.topic)

    def _on_message(self, client, userdata, msg):
        payload = msg.payload
        if self.raw_dump_dir:
            os.makedirs(self.raw_dump_dir, exist_ok=True)
            ts = int(time.time() * 1000)
            with open(os.path.join(self.raw_dump_dir, f'raw_{ts}_{self.frame_counter}.bin'), 'wb') as f:
                f.write(payload)

        parsed = None
        for offs in (0, 4, 8, 12):
            try:
                p = try_parse_laserscan_from(payload, offset=offs)
                if validate_parsed(p):
                    parsed = p
                    if self.verbose:
                        print(f"[ok] parsed at offset {offs}, seq={p['seq']}, ranges={len(p['ranges'])}")
                    break
            except Exception as e:
                if self.verbose and offs == 0:
                    print(f"[dbg] primary parse failed: {e}")
                continue

        if parsed is None:
            print(f"[warn] could not parse payload (len={len(payload)}). Raw dump dir: {self.raw_dump_dir or 'none'}")
            self.frame_counter += 1
            return

        if self.use_header_stamp and parsed.get('stamp_sec', None) is not None:
            try:
                stamp_ms = int(parsed['stamp_sec']) * 1000 + int(parsed['stamp_nanosec'] // 1_000_000)
            except Exception:
                stamp_ms = int(time.time() * 1000)
        else:
            stamp_ms = int(time.time() * 1000)

        raw_seq = parsed.get('seq', None)
        if self.verbose:
            print(f"[hdr] seq={raw_seq}, frame_id='{parsed.get('frame_id')}', stamp={parsed.get('stamp_sec')}.{parsed.get('stamp_nanosec')}")

        use_header_seq = False
        if self.prefer_header_seq and raw_seq is not None:
            if raw_seq != 0 and (self.last_seq is None or raw_seq != self.last_seq):
                use_header_seq = True

        if use_header_seq:
            frame_index = raw_seq
        else:
            frame_index = self.frame_counter

        self.last_seq = raw_seq

        angle_min = parsed['angle_min']
        angle_inc = parsed['angle_increment']
        range_min = parsed['range_min']
        range_max = parsed['range_max']
        ranges = parsed['ranges']

        rows_written = 0
        for i, r in enumerate(ranges):
            angle_rad = angle_min + i * angle_inc
            angle_deg = math.degrees(angle_rad)
            if r is None or (not math.isfinite(r)) or not (range_min <= r <= range_max) or r <= 0.0:
                rr = ''
                x = ''
                y = ''
            else:
                rr = r
                x = r * math.cos(angle_rad)
                y = r * math.sin(angle_rad)
            self.csv_writer.writerow([stamp_ms, frame_index, i, angle_deg, rr, x, y])
            rows_written += 1

        self.csv_fp.flush()
        if self.verbose:
            print(f"[save] frame {frame_index} -> {rows_written} points (ts={stamp_ms})")

        self.frame_counter += 1

    def start(self):
        try:
            self.client.connect(self.host, self.port, keepalive=60)
        except Exception as e:
            print("[error] cannot connect to MQTT broker:", e)
            raise
        self.client.loop_start()
        print("[run] listening, Ctrl+C to stop.")
        try:
            while not self.shutdown.is_set():
                time.sleep(0.1)
        finally:
            self.client.loop_stop()
            self.client.disconnect()
            self.close()
            print("[run] stopped and CSV closed.")

    def stop(self):
        self.shutdown.set()


# ---------------- CLI ----------------
def main():
    parser = argparse.ArgumentParser(description="MQTT LaserScan (CDR) -> CSV (no ROS needed). New CSV file created each run.")
    parser.add_argument('--host', default='mqtt-broker.local', help='MQTT broker host')
    parser.add_argument('--port', type=int, default=1888, help='MQTT broker port')
    parser.add_argument('--topic', default='MQTT/scan', help='MQTT topic to subscribe')
    parser.add_argument('--out', default='mqtt_laserscan.csv', help='CSV output base name (script will create <base>_N.csv)')
    parser.add_argument('--raw-dump', default=None, help='directory to dump raw payloads for debugging')
    parser.add_argument('--no-header-stamp', dest='use_header_stamp', action='store_false',
                        help="don't use header.stamp for timestamp, use receive time instead")
    parser.add_argument('--prefer-header-seq', action='store_true',
                        help='use header.seq as frameIndex when it looks valid (default uses internal counter)')
    parser.add_argument('--quiet', action='store_true', help='reduce verbosity')
    args = parser.parse_args()

    # compute next available unique filename
    out_path = next_out_path(args.out)
    print(f"[info] using output file: {out_path}")

    collector = MQTTCollector(
        host=args.host,
        port=args.port,
        topic=args.topic,
        out_csv=out_path,
        raw_dump_dir=args.raw_dump,
        use_header_stamp=args.use_header_stamp,
        verbose=not args.quiet,
        prefer_header_seq=args.prefer_header_seq
    )

    import signal
    def on_sig(signum, frame):
        print("\n[ctrlc] stopping...")
        collector.stop()
    signal.signal(signal.SIGINT, on_sig)
    signal.signal(signal.SIGTERM, on_sig)

    collector.start()


if __name__ == '__main__':
    main()
