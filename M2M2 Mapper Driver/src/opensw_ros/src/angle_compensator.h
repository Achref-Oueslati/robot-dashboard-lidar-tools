#pragma once

#include <vector>
#include <cmath>
#include <limits>
#include <algorithm>    // std::min/std::max
#include <opensw/types.h>

namespace opensw_ros {

// AngleCompensator: resamples laser points onto a regular angular grid.
// - target_points: number of angular bins (e.g., 920)
// - each bin receives the closest valid point in angle (or remains invalid).
class AngleCompensator {
public:
    explicit AngleCompensator(size_t target_points = 920) noexcept
        : target_points_(target_points),
          PI(3.14159265358979323846f),
          angle_increment_(2.0f * PI / static_cast<float>(target_points_)),
          inv_angle_increment_(1.0f / angle_increment_)
    {}

    // Compensates (resamples) the input points onto a uniform angular grid.
    // Returns a vector of size target_points_; bins without a point remain invalid.
    std::vector<opensw::LaserPoint> compensate(const std::vector<opensw::LaserPoint>& input_points) const noexcept {
        if (input_points.size() < 2) return input_points;

        std::vector<opensw::LaserPoint> output(target_points_);

    // Initialization: grid angles, infinite distances, and invalid flags.
        for (size_t i = 0; i < target_points_; ++i) {
            output[i].angle = -PI + static_cast<float>(i) * angle_increment_;
            output[i].distance = std::numeric_limits<float>::infinity();
            output[i].valid = false;
        }

    // Map each input point to the nearest grid index.
        for (const auto& p : input_points) {
            if (!p.valid) continue;

            float a = normalizeAngle(p.angle); // (-PI, PI]
            // index = round((a + PI) / angle_increment_)
            int idx = static_cast<int>(std::floor((a + PI) * inv_angle_increment_ + 0.5f));
            idx = std::max(0, std::min<int>(static_cast<int>(target_points_) - 1, idx));

            float target_angle = -PI + static_cast<float>(idx) * angle_increment_;

            // Choose the point whose angle is closest to the center of the bin
            if (!output[idx].valid ||
                std::fabs(a - target_angle) < std::fabs(normalizeAngle(output[idx].angle) - target_angle)) {
                output[idx] = p;
                output[idx].angle = target_angle; // align to the grid angle
                output[idx].valid = true;
            }
        }

        return output;
    }

private:
    // Normalize to (-PI, PI] — note inclusion of PI and exclusion of -PI.
    float normalizeAngle(float angle) const noexcept {
        // Simple loops: sufficient and clear for small deviations.
        while (angle > PI)  angle -= 2.0f * PI;
        while (angle <= -PI) angle += 2.0f * PI;
        return angle;
    }

    const size_t target_points_;
    const float PI;
    const float angle_increment_;
    const float inv_angle_increment_;
};

} // namespace opensw_ros
