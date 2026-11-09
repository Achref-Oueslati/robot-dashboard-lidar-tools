#!/bin/bash
# Usage: ./rosbag_to_csv.sh <bag_name> <csv_name>
# Example: ./rosbag_to_csv.sh my_scan_bag my_scan_export

set -e

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <bag_name> <csv_name>"
  exit 1
fi

BAG_NAME="$1"
CSV_NAME="$2"
BAG_PATH="/home/achref/ROS2_Humble/ros2_ws/Rosbag_files/$BAG_NAME"
CSV_PATH="/home/achref/ROS2_Humble/ros2_ws/CSV_files/$CSV_NAME.csv"

# Number of LIDAR bins (adjust if needed)
BINS=920

# Build header string
HEADER="stamp,seq,type,angle_min,angle_max,angle_increment,time_increment,scan_time,range_min,range_max"
for ((i=0; i<$BINS; i++)); do
  HEADER+=",range_$i"
done


# Record the bag
echo "Recording /scan to $BAG_PATH ..."
ros2 bag record /scan -o "$BAG_PATH"

# Export to CSV with header (start echo in background)
echo "Exporting /scan to $CSV_PATH ..."
echo "$HEADER" > "$CSV_PATH"
ros2 topic echo /scan --csv >> "$CSV_PATH" &
ECHO_PID=$!
sleep 2  # Give echo time to start listening

# Play the bag
echo "Playing $BAG_PATH ..."
ros2 bag play "$BAG_PATH"

# Allow time for echo to finish capturing
sleep 2
kill $ECHO_PID

echo "Done! CSV saved to $CSV_PATH"
