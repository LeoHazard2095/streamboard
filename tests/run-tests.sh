#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p tests/out
javac -encoding UTF-8 -d tests/out \
  app/src/main/java/com/techboard/streamboard/model/Channel.java \
  app/src/main/java/com/techboard/streamboard/model/ChannelGroup.java \
  app/src/main/java/com/techboard/streamboard/core/CategoryClassifier.java \
  app/src/main/java/com/techboard/streamboard/core/M3uParser.java \
  app/src/main/java/com/techboard/streamboard/core/ChannelIdentity.java \
  app/src/main/java/com/techboard/streamboard/core/ChannelMerge.java \
  app/src/main/java/com/techboard/streamboard/core/SourceSelector.java \
  tests/ParserTest.java tests/MergeTest.java tests/PerformanceTest.java
java -cp tests/out ParserTest
java -cp tests/out MergeTest
java -cp tests/out PerformanceTest
