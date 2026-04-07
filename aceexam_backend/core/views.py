import os
import subprocess
import tempfile
import traceback
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

# Use the bundled ffmpeg binary from imageio_ffmpeg
try:
    import imageio_ffmpeg
    FFMPEG_BIN = imageio_ffmpeg.get_ffmpeg_exe()
    print(f"[Voice AI] Using ffmpeg: {FFMPEG_BIN}")
except ImportError:
    FFMPEG_BIN = "ffmpeg"  # fallback to system PATH
    print("[Voice AI] WARNING: imageio_ffmpeg not found, falling back to system ffmpeg")


@csrf_exempt
def predict_command(request):
    if request.method != "POST" or not request.FILES.get("audio"):
        return JsonResponse({"error": "Invalid request. Send POST with 'audio' file."}, status=400)

    audio_file = request.FILES["audio"]
    webm_path = None
    wav_path = None

    try:
        # 1. Save the raw browser blob (webm/ogg) to a temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
            for chunk in audio_file.chunks():
                tmp.write(chunk)
            webm_path = tmp.name

        file_size = os.path.getsize(webm_path)
        print(f"[Voice AI] Received audio file: {webm_path} ({file_size} bytes)")

        if file_size < 100:
            print("[Voice AI] File too small, skipping")
            return JsonResponse({"command": "silence"})

        # 2. Convert webm -> 16kHz mono WAV using bundled ffmpeg
        wav_path = webm_path.replace(".webm", ".wav")
        result = subprocess.run(
            [
                FFMPEG_BIN, "-y",        # overwrite without asking
                "-i", webm_path,         # input
                "-ar", "16000",          # resample to 16 kHz
                "-ac", "1",              # mono
                "-f", "wav",             # force WAV format
                wav_path,                # output
            ],
            capture_output=True,
            text=True,
            timeout=10,
        )

        if result.returncode != 0:
            print(f"[Voice AI] ffmpeg FAILED (code {result.returncode})")
            print(f"[Voice AI] ffmpeg stderr: {result.stderr[:500]}")
            return JsonResponse({"command": "silence", "error": "Audio conversion failed"})

        wav_size = os.path.getsize(wav_path)
        print(f"[Voice AI] Converted to WAV: {wav_path} ({wav_size} bytes)")

        if wav_size < 1000:
            print("[Voice AI] WAV too small after conversion, likely silence")
            return JsonResponse({"command": "silence"})

        # 3. Run PyTorch inference on the clean WAV
        from core.ml_model.inference import predict_audio_command
        prediction = predict_audio_command(wav_path)
        print(f"[Voice AI] ✓ AI Prediction: {prediction}")

        return JsonResponse({"command": prediction})

    except Exception as e:
        print(f"[Voice AI] ✗ Server error: {e}")
        traceback.print_exc()
        return JsonResponse({"command": "error", "detail": str(e)}, status=500)

    finally:
        # 4. Cleanup temp files
        for path in (webm_path, wav_path):
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except OSError:
                    pass
