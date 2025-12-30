import 'package:flutter/material.dart';
import '../services/pull_progress_service.dart';

class GlobalPullProgressWidget extends StatelessWidget {
  const GlobalPullProgressWidget({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<PullStatus?>(
      valueListenable: PullProgressService().progress,
      builder: (context, status, child) {
        if (status == null) return const SizedBox.shrink();

        Color bgColor = const Color(0xFF1E1E1E);
        Color accentColor = const Color(0xFF00E5FF);
        IconData icon = Icons.downloading;

        if (status.error != null) {
          bgColor = Colors.redAccent.withOpacity(0.9);
          accentColor = Colors.white;
          icon = Icons.error_outline;
        } else if (status.isDone) {
          bgColor = Colors.greenAccent.withOpacity(0.9);
          accentColor = Colors.black;
          icon = Icons.check_circle_outline;
        }

        return Card(
          color: bgColor,
          elevation: 8,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              children: [
                Icon(icon, color: accentColor),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        status.image,
                        style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      if (status.error != null)
                        Text(
                           status.error!,
                           style: const TextStyle(color: Colors.white, fontSize: 12)
                        )
                      else if (status.isDone)
                        const Text(
                           'Completed',
                           style: TextStyle(color: Colors.black, fontSize: 12, fontWeight: FontWeight.bold)
                        )
                      else
                        Row(
                          children: [
                             Expanded(
                              child: LinearProgressIndicator(
                                value: status.percent > 0 ? status.percent / 100 : null,
                                backgroundColor: Colors.white12,
                                color: accentColor,
                                minHeight: 4,
                              ),
                             ),
                             const SizedBox(width: 8),
                             Text(
                               '${status.percent}%',
                               style: const TextStyle(color: Colors.white70, fontSize: 12),
                             ),
                          ],
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
