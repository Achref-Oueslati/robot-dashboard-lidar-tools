## Record a Topic

To record the `/scan` topic:

```
ros2 bag record /scan
```

This will create a new rosbag file in the current directory.

### Specify Output Folder

To save the bag file in a specific folder, use the `-o` or `--output` option:

```
ros2 bag record /scan -o /home/achref/ROS2_Humble/ros2_ws/Rosbag_files/my_scan_bag
```

This will create the bag folder `my_scan_bag` inside `Rosbag_files`.

## Play Back a Bag File

To play back a recorded bag file (folder: `rosbag2_2025_10_28-12_07_52`):

```
ros2 bag play rosbag2_2025_10_28-12_07_52
```

## Visualize and Manage Bags with rqt_bag

You can use `rqt_bag` to view, inspect, and export data from bag files with a graphical interface:

```
rqt_bag
```

Open your bag file from the GUI to visualize topics, export messages, and more.

## Export Topic Data to CSV

After playing the bag file, export `/scan` topic data to a CSV file:

```
ros2 topic echo /scan --csv > scan_export.csv
```

This will save the `/scan` topic messages in CSV format to `scan_export.csv`.

### Specify Export Path

To save the CSV file to a specific location, provide the full path:

```
ros2 topic echo /scan --csv > /home/achref/ROS2_Humble/ros2_ws/CSV_files/scan_export.csv
```

This will save the CSV directly to the `CSV_files` folder.


## Automated Bag to CSV Workflow

You can automate the entire process (record, play, export to CSV with headers) using the provided script:

### Usage

```bash
./rosbag_to_csv.sh <bag_name> <csv_name>
```

This will:
- Record `/scan` to `Rosbag_files/<bag_name>`
- Play the bag file and republish the data
- Export `/scan` topic to `CSV_files/<csv_name>.csv` with headers for easy reading

**Example:**

```bash
./rosbag_to_csv.sh my_scan_bag my_scan_export
```

Make sure the script is executable:

```bash
chmod +x rosbag_to_csv.sh
```

This workflow ensures your CSV files are always readable and complete, with no manual steps required.
