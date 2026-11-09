# Scan Data Pipeline (Dashboard Widget)

**1. Live Data Reception:**
- Widget subscribes to `/scan` topic via rosbridge.


**2. Recording:**
- Click "Start Recording" to capture scan frames in browser memory.
- The widget records the converted scan data (angle, range, x, y, etc.), not the raw ROS message fields.



**3. Export:**
- Click "Export CSV" to download all recorded points as a CSV file.
- **CSV Data Format:**
	- Each row is a scan point from a recorded frame (converted data).
	- Columns:
		- `timestamp`: When the frame was recorded (milliseconds since epoch)
		- `frameIndex`: Which scan frame this point belongs to
		- `pointIndex`: Index of the point in the scan
		- `angleDeg`: Angle of the point (degrees)
		- `range`: Distance (meters), or empty if invalid
		- `x`, `y`: Cartesian coordinates (meters), or empty if invalid

**Note:**
- The scan widget does not record or export the raw ROS LaserScan message fields—only the processed/converted data is saved.

**Note:**
- Data is stored in browser memory until exported.
- Exported CSV is saved to your local computer (Downloads folder).

---
This is a client-side pipeline; no data is saved to the server or workspace folders unless you move it manually.
