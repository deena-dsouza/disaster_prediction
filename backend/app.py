from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch
import numpy as np
from PIL import Image
import io
import base64
from torchvision.models.segmentation import deeplabv3_resnet50
# import tensorflow as tf  # commented

app = FastAPI(title="DisasterVision API", description="Flood & Landslide Prediction API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =======================
# 1. Load PyTorch models
# =======================
def load_torch_model(path):
    try:
        model = deeplabv3_resnet50(pretrained=False, num_classes=2)
        state_dict = torch.load(path, map_location="cpu")
        model.load_state_dict(state_dict, strict=False)
        model.eval()
        print(f"Loaded PyTorch model: {path}")
        return model
    except Exception as e:
        print(f"Error loading {path}: {e}")
        return None

deeplab_model = load_torch_model("backend/models/best_deeplabv3.pth")
landslide_seg_model = load_torch_model("backend/models/landslide_segmentation .pth")

# =======================
# 2. TensorFlow models (commented)
# =======================
# flood_weather_model = None
# try:
#     flood_weather_model = tf.keras.models.load_model(
#         "backend/models/flood_risk_regression_model.h5", compile=False
#     )
#     print("Loaded TF flood model.")
# except Exception as e:
#     print("Error loading TF flood model:", e)

# landslide_lstm_model = None
# try:
#     landslide_lstm_model = tf.keras.models.load_model("backend/models/landslide_lstm_model.h5", compile=False)
#     print("Loaded TF landslide LSTM model.")
# except Exception as e:
#     print("Error loading landslide LSTM model:", e)

# =======================
# 3. Request Schemas
# =======================
class FloodRequest(BaseModel):
    image_base64: str
    # temperature: float  # commented
    # humidity: float
    # rainfall: float
    # windspeed: float

class LandslideRequest(BaseModel):
    image_base64: str
    # weather data commented

# =======================
# 4. Root route
# =======================
@app.get("/")
def root():
    return {"message": "DisasterVision backend is running!"}

# =======================
# 5. Flood prediction (PyTorch only)
# =======================
@app.post("/predict/flood")
async def predict_flood(req: FloodRequest):
    if deeplab_model is None:
        raise HTTPException(status_code=500, detail="Flood segmentation model not loaded.")

    try:
        header, encoded = req.image_base64.split(",", 1)
        img_bytes = base64.b64decode(encoded)
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot parse image: {e}")

    img = img.resize((256, 256))
    img_array = np.array(img) / 255.0
    img_tensor = torch.tensor(img_array).permute(2, 0, 1).float().unsqueeze(0)

    with torch.no_grad():
        output = deeplab_model(img_tensor)["out"]
    flood_pixels = (output.argmax(1) == 1).sum().item()
    image_pred = 1 if flood_pixels > 500 else 0

    # future_pred = None  # TF regression commented

    return {
        "image_prediction": image_pred,
        "future_prediction": None
    }

# =======================
# 6. Landslide prediction (PyTorch only)
# =======================
@app.post("/predict/landslide")
async def predict_landslide(req: LandslideRequest):
    if landslide_seg_model is None:
        raise HTTPException(status_code=500, detail="Landslide segmentation model not loaded.")

    try:
        header, encoded = req.image_base64.split(",", 1)
        img_bytes = base64.b64decode(encoded)
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot parse image: {e}")

    img = img.resize((256, 256))
    img_array = np.array(img) / 255.0
    img_tensor = torch.tensor(img_array).permute(2, 0, 1).float().unsqueeze(0)

    with torch.no_grad():
        output = landslide_seg_model(img_tensor)["out"]
    landslide_pixels = (output.argmax(1) == 1).sum().item()
    image_pred = 1 if landslide_pixels > 500 else 0

    return {
        "image_prediction": image_pred,
        "future_prediction": None
    }
