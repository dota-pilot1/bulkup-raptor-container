# Browser speech input

The Lexical toolbar places a prominent `말로 입력` button at the end. When the browser exposes `SpeechRecognition` or `webkitSpeechRecognition`, clicking it starts Korean (`ko-KR`) continuous recognition with interim results. Final phrases are inserted directly at the selection saved before toolbar focus. A second click stops recognition, and an automatic stop limits a session to 60 seconds.

There is no bundled or downloaded speech model, native speech executable, local speech API, or recorded-audio persistence. Browser implementations may send audio to their recognition service and may require a network connection. Unsupported browsers hide the toolbar button.

The macOS bundle includes both `NSMicrophoneUsageDescription` and `NSSpeechRecognitionUsageDescription`, and its signing entitlements allow audio input. macOS stores these approvals for the app bundle identifier. If access was previously denied, enable **Tikitaka Note** under **System Settings > Privacy & Security > Microphone** and **Speech Recognition**, then restart the app.

The microphone button is hidden only inside the raw macOS app process started by `tauri dev`. That process has no application bundle `Info.plist`, so macOS TCC terminates it when Web Speech requests speech-recognition access. Use a packaged Tauri `.app` to test desktop speech input. Running the Next.js development URL in a supported browser remains available for browser-level testing.
