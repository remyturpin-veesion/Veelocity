import 'package:flutter/material.dart';

/// A skeleton loading card that mimics KPICard layout.
class SkeletonCard extends StatefulWidget {
  const SkeletonCard({super.key});

  @override
  State<SkeletonCard> createState() => _SkeletonCardState();
}

class _SkeletonCardState extends State<SkeletonCard>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    )..repeat();
    _animation = Tween<double>(begin: -1.0, end: 2.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20.0),
        child: AnimatedBuilder(
          animation: _animation,
          builder: (context, child) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    _buildShimmer(width: 40, height: 40, circular: true),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _buildShimmer(width: 120, height: 16),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                _buildShimmer(width: 100, height: 32),
                const SizedBox(height: 8),
                _buildShimmer(width: 150, height: 14),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildShimmer({
    required double width,
    required double height,
    bool circular = false,
  }) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        borderRadius: circular ? null : BorderRadius.circular(4),
        shape: circular ? BoxShape.circle : BoxShape.rectangle,
        gradient: LinearGradient(
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
          colors: [
            Colors.grey[300]!,
            Colors.grey[100]!,
            Colors.grey[300]!,
          ],
          stops: [
            (_animation.value - 1).clamp(0.0, 1.0),
            _animation.value.clamp(0.0, 1.0),
            (_animation.value + 1).clamp(0.0, 1.0),
          ],
        ),
      ),
    );
  }
}

/// Grid of skeleton cards for loading state.
class SkeletonGrid extends StatelessWidget {
  final int count;
  final bool isWide;

  const SkeletonGrid({
    super.key,
    this.count = 4,
    this.isWide = true,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final cardWidth = isWide && constraints.maxWidth > 600
            ? (constraints.maxWidth - 16) / 2
            : constraints.maxWidth;

        return Wrap(
          spacing: 16,
          runSpacing: 16,
          children: List.generate(count, (index) {
            return SizedBox(
              width: cardWidth,
              child: const SkeletonCard(),
            );
          }),
        );
      },
    );
  }
}
