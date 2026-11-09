# Robot Dashboard and LiDAR Data Tools

This workspace collects ROS 2 LiDAR integration code, MQTT utilities, and two
web dashboard projects.

## Projects

- `Robot-dashboard/`: React/Next.js robot dashboard
- `Robot-dashbord-laserscan-vite/`: Vite-based LiDAR dashboard
- `M2M2 Mapper Driver/`: mapper driver sources and integration notes
- `mqtt/`: MQTT scan bridge and conversion tools
- `rosbridge_suite_installation.md`: rosbridge setup notes

## Data and publishing

`CSV_files/` and `Rosbag_files/` contain recorded sensor data. Review and
anonymize these files before publishing; remove datasets that are not intended
as public examples. They may be large and are not required to build the
applications.

## Run a dashboard

Choose a dashboard directory and follow its package scripts. For example:

```bash
cd Robot-dashboard
npm install
npm run dev
```

Configure local broker settings in the MQTT YAML files before use. Store
credentials only in local, untracked configuration or a secret manager.
