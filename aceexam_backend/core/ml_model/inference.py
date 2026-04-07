import os
import json
import traceback

# Setup paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, 'exam_listener_v1.pt')
LABELS_PATH = os.path.join(BASE_DIR, 'class_labels.json')

_model = None
_idx_to_class = None
_mfcc_transform = None


def _load_model():
    """Load torch model and labels on first use."""
    global _model, _idx_to_class, _mfcc_transform

    if _model is not None:
        return

    import torch
    import torch.nn as nn
    import torchaudio

    # Validate files exist
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"[inference.py] Model file not found: {MODEL_PATH}")
    if not os.path.exists(LABELS_PATH):
        raise FileNotFoundError(f"[inference.py] Labels file not found: {LABELS_PATH}")

    # Load the class labels
    with open(LABELS_PATH, 'r') as f:
        _idx_to_class = json.load(f)
    print(f"[inference.py] Loaded {len(_idx_to_class)} class labels: {list(_idx_to_class.values())}")

    # Rebuild the brain structure (must match Colab exactly)
    class ExamListenerNetwork(nn.Module):
        def __init__(self, num_classes):
            super().__init__()
            self.conv1 = nn.Conv2d(1, 16, kernel_size=3, stride=1, padding=1)
            self.relu = nn.ReLU()
            self.pool = nn.MaxPool2d(2, 2)
            self.conv2 = nn.Conv2d(16, 32, kernel_size=3, stride=1, padding=1)
            self.flatten = nn.Flatten()
            self.fc1 = nn.Linear(32 * 10 * 25, 128)
            self.fc2 = nn.Linear(128, num_classes)

        def forward(self, x):
            x = self.pool(self.relu(self.conv1(x)))
            x = self.pool(self.relu(self.conv2(x)))
            x = self.flatten(x)
            x = self.relu(self.fc1(x))
            x = self.fc2(x)
            return x

    # Initialize and load the model
    num_classes = len(_idx_to_class)
    _model = ExamListenerNetwork(num_classes)
    try:
        _model.load_state_dict(torch.load(MODEL_PATH, map_location=torch.device('cpu'), weights_only=True))
        _model.eval()
        print(f"[inference.py] Model loaded successfully ({os.path.getsize(MODEL_PATH)} bytes)")
    except RuntimeError as e:
        print(f"[inference.py] ✗ MODEL ARCHITECTURE MISMATCH: {e}")
        raise

    # Setup the MFCC transform (matches training config)
    _mfcc_transform = torchaudio.transforms.MFCC(
        sample_rate=16000, n_mfcc=40, melkwargs={"n_fft": 400, "hop_length": 160}
    )


def predict_audio_command(audio_file_path):
    """Takes audio path (WAV), returns predicted command word."""
    try:
        import torch
        import soundfile as sf

        _load_model()

        print(f"[inference.py] Loading audio: {audio_file_path} ({os.path.getsize(audio_file_path)} bytes)")

        # --- Use soundfile directly (bypasses broken torchaudio.load) ---
        data, sr = sf.read(audio_file_path, dtype='float32')
        print(f"[inference.py] soundfile loaded: shape={data.shape}, sr={sr}")

        # Convert numpy array to torch tensor
        # soundfile returns (samples,) for mono or (samples, channels) for stereo
        if data.ndim == 1:
            waveform = torch.from_numpy(data).unsqueeze(0)  # (1, samples)
        else:
            # Stereo -> mono by averaging channels
            waveform = torch.from_numpy(data.mean(axis=1)).unsqueeze(0)

        print(f"[inference.py] Waveform tensor: shape={waveform.shape}, sr={sr}")

        # Resample to 16kHz if needed
        if sr != 16000:
            import torchaudio
            resampler = torchaudio.transforms.Resample(orig_freq=sr, new_freq=16000)
            waveform = resampler(waveform)
            print(f"[inference.py] Resampled to 16kHz: shape={waveform.shape}")

        # Pad or trim to exactly 1 second (16000 samples)
        num_samples = 16000
        if waveform.shape[1] > num_samples:
            waveform = waveform[:, :num_samples]
        elif waveform.shape[1] < num_samples:
            waveform = torch.nn.functional.pad(waveform, (0, num_samples - waveform.shape[1]))

        print(f"[inference.py] Final waveform: shape={waveform.shape}")

        mfcc = _mfcc_transform(waveform).unsqueeze(0)
        print(f"[inference.py] MFCC shape: {mfcc.shape}")

        with torch.no_grad():
            outputs = _model(mfcc)
            probabilities = torch.nn.functional.softmax(outputs, dim=1)
            confidence, predicted_idx = torch.max(probabilities, 1)

        label = _idx_to_class[str(predicted_idx.item())]
        print(f"[inference.py] ✓ Prediction: '{label}' (confidence: {confidence.item():.2%})")
        return label

    except Exception as e:
        print(f"[inference.py] ✗ Prediction Error: {e}")
        traceback.print_exc()
        return "error"