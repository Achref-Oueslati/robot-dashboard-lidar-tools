import rclpy
from rclpy.node import Node
from sensor_msgs.msg import LaserScan
import math

class ScanCounter(Node):
    def __init__(self):
        super().__init__('scan_counter')
        self.subscription = self.create_subscription(
            LaserScan,
            'scan',
            self.listener_callback,
            10)
        self.subscription  # prevent unused variable warning

    def listener_callback(self, msg):
        total = len(msg.ranges)
        valid = sum(1 for r in msg.ranges if math.isfinite(r))
        invalid = total - valid
        self.get_logger().info(f'Readings: total={total}, valid={valid}, invalid={invalid}')

def main(args=None):
    rclpy.init(args=args)
    node = ScanCounter()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()