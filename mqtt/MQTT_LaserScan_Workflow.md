# MQTT LaserScan to CSV Workflow

## Folder Contents

### `mqtt_scan_to_csv.py`
- **Purpose:** Subscribes to an MQTT topic, receives ROS2 CDR-serialized `sensor_msgs/LaserScan` messages, parses them, and exports scan data to a CSV file.
- **Features:**
  - Pure Python.
  - Handles small wrappers/prefixes in payloads.
  - Supports options for timestamping, frame indexing, and raw payload dumps.
  - Output columns: `timestamp`, `frameIndex`, `pointIndex`, `angleDeg`, `range`, `x`, `y`.

### `scan_bridge.yaml`
- **Purpose:** Configuration file (typically for ROS2 or bridge setup).
- **Usage:** Not directly used by the Python script, but may be referenced by ROS2 nodes or bridge utilities.

## Example Output: CSV File

A generated CSV (e.g., `mqtt_laserscan_0.csv`) contains rows like:
```
timestamp,frameIndex,pointIndex,angleDeg,range,x,y
1761920894784,0,62,-155.73913433709185,0.3661254346370697,-0.3337907512054791,-0.15043792174137866
...
```
- **timestamp:** Milliseconds since epoch (from message header or receive time).
- **frameIndex:** Scan/frame identifier.
- **pointIndex:** Index of the point in the scan.
- **angleDeg:** Angle in degrees.
- **range:** Distance measurement (may be empty if invalid).
- **x, y:** Cartesian coordinates (may be empty if invalid).

## How to Run

1. **Install dependencies:**
   ```bash
   pip install paho-mqtt
   ```

2. **Run the script:**
   ```bash
   python3 mqtt_scan_to_csv.py --host <MQTT_HOST> --port <MQTT_PORT> --topic <MQTT_TOPIC> --out <OUTPUT_CSV>
   ```
   - Example:
     ```bash
     python3 mqtt_scan_to_csv.py --host mqtt-broker.local --port 1888 --topic MQTT/scan --out CSV_files/mqtt_laserscan_0.csv
     ```
   - or simply:
     ```bash
     python3 mqtt_scan_to_csv.py
     ```

3. **Options:**
   - `--raw-dump DIR` : Save raw payloads for debugging.
   - `--no-header-stamp` : Use receive time instead of message header timestamp.
   - `--prefer-header-seq` : Use message sequence number for frame index.
   - `--quiet` : Reduce verbosity.

## Notes

- The script will create a new CSV file for each run if not specified.