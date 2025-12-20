import 'package:flutter/material.dart';

class SquareScalingSpinner extends StatefulWidget {
  final double size;
  final Color? color;

  const SquareScalingSpinner({super.key, this.size = 50.0, this.color});

  @override
  State<SquareScalingSpinner> createState() => _SquareScalingSpinnerState();
}

class _SquareScalingSpinnerState extends State<SquareScalingSpinner>
    with TickerProviderStateMixin {
  late List<AnimationController> _controllers;
  late List<Animation<double>> _animations;

  @override
  void initState() {
    super.initState();
    _controllers = List.generate(4, (index) {
      return AnimationController(
        vsync: this,
        duration: const Duration(milliseconds: 600),
      );
    });

    _animations = _controllers.map((controller) {
      return Tween<double>(begin: 0.0, end: 1.0).animate(
        CurvedAnimation(parent: controller, curve: Curves.easeInOutCubic),
      );
    }).toList();

    _startAnimation();
  }

  void _startAnimation() async {
    for (int i = 0; i < 4; i++) {
      await Future.delayed(const Duration(milliseconds: 150));
      if (mounted) {
        _controllers[i].repeat(reverse: true);
      }
    }
  }

  @override
  void dispose() {
    for (var controller in _controllers) {
      controller.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final squareSize = widget.size / 2 - 4; // Space for gaps
    final color = widget.color ?? Theme.of(context).primaryColor;

    Widget buildSquare(int index) {
      return AnimatedBuilder(
        animation: _animations[index],
        builder: (context, child) {
          // Scale from 0.0 to 1.0, Opacity from 0.5 to 1.0 (or 0.2 to 1.0)
          final value = _animations[index].value;
          final scale = 0.2 + (value * 0.8); 
          final opacity = 0.4 + (value * 0.6);

          return Transform.scale(
            scale: scale,
            child: Opacity(
              opacity: opacity,
              child: Container(
                width: squareSize,
                height: squareSize,
                decoration: BoxDecoration(
                  color: color,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ),
          );
        },
      );
    }

    return SizedBox(
      width: widget.size,
      height: widget.size,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [buildSquare(0), buildSquare(1)],
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [buildSquare(3), buildSquare(2)],
          ),
        ],
      ),
    );
  }
}
