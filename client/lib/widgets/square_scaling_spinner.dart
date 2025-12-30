import 'package:flutter/material.dart';

class SquareScalingSpinner extends StatefulWidget {
  final double size;
  final Color? color;

  const SquareScalingSpinner({super.key, this.size = 50.0, this.color});

  @override
  State<SquareScalingSpinner> createState() => _SquareScalingSpinnerState();
}

class _SquareScalingSpinnerState extends State<SquareScalingSpinner>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  double _getScale(double progress, double shift) {
    // CSS logic: 
    // 0% -> 0.4
    // 20% -> 1.0
    // 40% -> 0.4
    // 100% -> 0.4
    // Negative Delay means we start at that point in the cycle.
    // So effective progress = (controller.value - delay_fraction) % 1.0
    // Note: CSS delay is negative, so we ADD to progress? 
    // delay -0.3s means animation has ALREADY played 0.3s. So t=0.3.
    // Yes, we add the shift.
    
    double t = (progress + shift) % 1.0;
    
    if (t < 0.2) {
      // 0.0 to 0.2 -> 0.4 to 1.0
      // Normalizing t to 0..1 for the interval: t / 0.2
      // Using EaseInOut to match "ease-in-out" in CSS
      return 0.4 + (1.0 - 0.4) * Curves.easeInOut.transform(t / 0.2);
    } else if (t < 0.4) {
      // 0.2 to 0.4 -> 1.0 to 0.4
      // Normalizing t to 0..1: (t - 0.2) / 0.2
      return 1.0 - (1.0 - 0.4) * Curves.easeInOut.transform((t - 0.2) / 0.2);
    } else {
      // 0.4 to 1.0 -> 0.4 constant
      return 0.4;
    }
  }

  @override
  Widget build(BuildContext context) {
    // Total size includes gap. 
    // In WebUI: size=48, square ~20? Gap=1 (0.25rem).
    // Here we can stick to the size sizing logic but maybe adjust.
    // widget.size is total width/height.
    // 2 squares + 1 gap.
    // Let's say gap is fixed at 4 or proportional.
    final double gap = 4.0;
    final double squareSize = (widget.size - gap) / 2;
    final Color color = widget.color ?? Theme.of(context).primaryColor;

    // CSS Delays:
    // TL: -0.3s -> shift 0.3/1.2 = 0.25
    // TR: -0.1s -> shift 0.1/1.2 = 0.0833
    // BL: -0.2s -> shift 0.2/1.2 = 0.1666
    // BR: 0s -> shift 0.0
    
    return SizedBox(
      width: widget.size,
      height: widget.size,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, child) {
          return Column(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _buildSquare(color, squareSize, 0.25),   // TL
                  _buildSquare(color, squareSize, 0.0833), // TR
                ],
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _buildSquare(color, squareSize, 0.1666), // BL
                  _buildSquare(color, squareSize, 0.0),    // BR
                ],
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildSquare(Color color, double size, double shift) {
    final scale = _getScale(_controller.value, shift);
    return Transform.scale(
      scale: scale,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(4), // rounded-sm equivalent
        ),
      ),
    );
  }
}
