import os
import subprocess
import tempfile
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from core.ml_model.inference import predict_audio_command


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

        print(f"[Voice AI] Received audio file: {webm_path} ({os.path.getsize(webm_path)} bytes)")

        # 2. Convert webm -> 16kHz mono WAV using ffmpeg
        wav_path = webm_path.replace(".webm", ".wav")
        result = subprocess.run(
            [
                "ffmpeg", "-y",          # overwrite without asking
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
            print(f"[Voice AI] ffmpeg error: {result.stderr[:500]}")
            return JsonResponse({"command": "silence", "error": "Audio conversion failed"})

        print(f"[Voice AI] Converted to WAV: {wav_path} ({os.path.getsize(wav_path)} bytes)")

        # 3. Run PyTorch inference on the clean WAV
        prediction = predict_audio_command(wav_path)
        print(f"[Voice AI] AI Prediction: {prediction}")

        return JsonResponse({"command": prediction})

    except Exception as e:
        print(f"[Voice AI] Server error: {e}")
        return JsonResponse({"command": "error", "detail": str(e)}, status=500)

    finally:
        # 4. Cleanup temp files
        for path in (webm_path, wav_path):
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except OSError:
                    pass
