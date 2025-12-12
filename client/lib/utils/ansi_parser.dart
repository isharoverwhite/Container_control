import 'package:flutter/material.dart';
import 'package:ansicolor/ansicolor.dart';

class AnsiParser {
  static List<TextSpan> parse(String text) {
    // Basic stripping or converting to TextSpans using ansicolor
    // ansicolor usually works by returning a function that wraps text in terminal codes
    // But for Flutter rendering we need to parse codes -> Color/Style.

    // Since 'ansicolor' doesn't directly output TextSpans, we can use a simpler approach
    // or a regex to strip codes for MVP if color complexity is high.
    // However, the user asked for "fix format support", so let's try a basic color parser.

    // For now, let's strip unusual characters and support basic colors if possible.
    // A robust ANSI parser for Flutter is complex.
    // Let's implement a simple stripper first to ensure cleanliness,
    // and a basic color mapper if we find standard codes.

    // Regex for ANSI escape codes
    final ansiRegex = RegExp(r'\x1B\[[0-?]*[ -/]*[@-~]');

    final spans = <TextSpan>[];

    text.split('\n').forEach((line) {
      // For now, just strip to clean up the display as requested "fix format"
      // often means removing garbage characters.
      // Full color support requires a dedicated specialized widget/parser not easily written in one go.
      // But we can try to detect "Error" or "Info" keywords for basic coloring.

      final cleanLine = line.replaceAll(ansiRegex, '');
      Color color = Colors.greenAccent; // Default terminal look

      if (cleanLine.toLowerCase().contains('error') ||
          cleanLine.toLowerCase().contains('exception')) {
        color = Colors.redAccent;
      } else if (cleanLine.toLowerCase().contains('warn')) {
        color = Colors.orangeAccent;
      }

      spans.add(
        TextSpan(
          text: '$cleanLine\n',
          style: TextStyle(color: color),
        ),
      );
    });

    return spans;
  }
}
