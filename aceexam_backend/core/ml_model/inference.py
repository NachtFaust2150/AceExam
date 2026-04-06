import os
import json
import torch
import torchaudio
import torch.nn as nn

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

# Setup paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, 'exam_listener_v1.pt')
LABELS_PATH = os.path.join(BASE_DIR, 'class_labels.json')

# Load the class labels
with open(LABELS_PATH, 'r') as f:
    idx_to_class = json.load(f)

# Initialize and load the model
num_classes = len(idx_to_class)
model = ExamListenerNetwork(num_classes)
model.load_state_dict(torch.load(MODEL_PATH, map_location=torch.device('cpu')))
model.eval()

# Setup the audio transform
mfcc_transform = torchaudio.transforms.MFCC(
    sample_rate=16000, n_mfcc=40, melkwargs={"n_fft": 400, "hop_length": 160}
)

def predict_audio_command(audio_file_path):
    """Takes audio path, returns predicted word."""
    try:
        waveform, sr = torchaudio.load(audio_file_path)
        
        # Standardize audio
        if sr != 16000:
            resampler = torchaudio.transforms.Resample(orig_freq=sr, new_freq=16000)
            waveform = resampler(waveform)
        if waveform.shape[0] > 1:
            waveform = torch.mean(waveform, dim=0, keepdim=True)
            
        num_samples = 16000
        if waveform.shape[1] > num_samples:
            waveform = waveform[:, :num_samples]
        elif waveform.shape[1] < num_samples:
            waveform = torch.nn.functional.pad(waveform, (0, num_samples - waveform.shape[1]))
            
        mfcc = mfcc_transform(waveform).unsqueeze(0)
        
        with torch.no_grad():
            outputs = model(mfcc)
            _, predicted_idx = torch.max(outputs, 1)
            
        return idx_to_class[str(predicted_idx.item())]
    except Exception as e:
        print(f"Prediction Error: {e}")
        return "error"