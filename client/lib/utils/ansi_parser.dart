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
    // Regex for control characters (Docker headers, etc) - keep \n
    final controlRegex = RegExp(r'[\x00-\x09\x0B-\x1F\x7F]');

    final spans = <TextSpan>[];

    text.split('\n').forEach((line) {
      var cleanLine = line.replaceAll(ansiRegex, '').replaceAll(controlRegex, '');
      if (cleanLine.isEmpty) return; // Skip empty lines after cleaning

      Color color = Colors.white; 

      if (cleanLine.toLowerCase().contains('error') ||
          cleanLine.toLowerCase().contains('exception') || 
          cleanLine.toLowerCase().contains('fatal')) {
        color = Colors.redAccent;
      } else if (cleanLine.toLowerCase().contains('warn')) {
        color = Colors.orangeAccent;
      } else if (cleanLine.toLowerCase().contains('info')) {
        color = Colors.blueAccent;
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
