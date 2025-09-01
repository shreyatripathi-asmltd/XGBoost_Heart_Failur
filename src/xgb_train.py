# src/xgb_train.py
# Train XGBoost on heart.csv, log to MLflow, and emit public/private indexes
import os, re, json, hashlib, warnings, urllib.parse
from pathlib import Path
warnings.filterwarnings("ignore")

from dotenv import load_dotenv
load_dotenv()

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from xgboost import XGBClassifier

import mlflow
import mlflow.sklearn
from mlflow.tracking import MlflowClient
from mlflow.models import infer_signature

# ----------------------------
# Env & MLflow configuration
# ----------------------------
TRACKING_URI = os.getenv("MLFLOW_TRACKING_URI", "http://127.0.0.1:5000")
EXPERIMENT_NAME = os.getenv("MLFLOW_EXPERIMENT_NAME", "heart_disease_xgboost")
ARTIFACT_LOCATION = os.getenv("MLFLOW_ARTIFACT_LOCATION", None)  # e.g. ./mlartifacts
REGISTERED_MODEL_NAME = os.getenv("MLFLOW_REGISTERED_MODEL_NAME", "xgb")

DATA_PATH = os.getenv("DATA_PATH", "data/heart_label_encoded.csv")
TARGET_COL = os.getenv("TARGET_COL", "HeartDisease")
TEST_SIZE = float(os.getenv("TEST_SIZE", "0.2"))
RANDOM_STATE = int(os.getenv("RANDOM_STATE", "42"))

mlflow.set_tracking_uri(TRACKING_URI)
client = MlflowClient(tracking_uri=TRACKING_URI)

# Ensure experiment exists
exp = client.get_experiment_by_name(EXPERIMENT_NAME)
if exp is None:
    exp_id = client.create_experiment(
        name=EXPERIMENT_NAME,
        artifact_location=ARTIFACT_LOCATION if ARTIFACT_LOCATION else None
    )
else:
    exp_id = exp.experiment_id
mlflow.set_experiment(EXPERIMENT_NAME)

# ----------------------------
# Load data
# ----------------------------
df = pd.read_csv(DATA_PATH)
if TARGET_COL not in df.columns:
    raise ValueError(f"Target column '{TARGET_COL}' not found in {DATA_PATH}")

X = df.drop(columns=[TARGET_COL])
y = df[TARGET_COL].astype(int)

for col in X.select_dtypes(include=["object", "category"]).columns:
    X[col] = X[col].astype(str)

categorical_cols = X.select_dtypes(include=["object", "category"]).columns.tolist()
numeric_cols = [c for c in X.columns if c not in categorical_cols]

# ----------------------------
# Split
# ----------------------------
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=TEST_SIZE, stratify=y, random_state=RANDOM_STATE
)

# ----------------------------
# Class imbalance
# ----------------------------
neg, pos = np.bincount(y_train)
if pos == 0:
    raise ValueError("Training set has no positive samples.")
scale_pos_weight = neg / pos

# ----------------------------
# Model
# ----------------------------
preprocessor = (
    ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore"), categorical_cols),
            ("num", "passthrough", numeric_cols),
        ]
    ) if len(categorical_cols) > 0 else "passthrough"
)

xgb = XGBClassifier(
    n_estimators=400, max_depth=4, learning_rate=0.05,
    subsample=0.9, colsample_bytree=0.9, reg_lambda=1.0,
    random_state=RANDOM_STATE, n_jobs=-1, eval_metric="logloss",
    scale_pos_weight=scale_pos_weight
)

pipe = Pipeline(steps=[("prep", preprocessor), ("clf", xgb)])

# ----------------------------
# Helpers for slugs & paths
# ----------------------------
def _slug(prefix: str, token: str) -> str:
    """Short, non-reversible slug from a token (id/name)."""
    h = hashlib.sha256(token.encode()).hexdigest()[:8]
    safe = re.sub(r"[^a-zA-Z0-9]+", "-", token.lower()).strip("-")[:12]
    return f"{prefix}-{safe}-{h}"

def _path_exists(p: str) -> bool:
    try:
        return Path(p).exists()
    except Exception:
        return False

def _guess_metrics_params_paths(run_id: str, experiment_id: str | int) -> dict:
    # For file-backed stores you'll have ./mlruns/<exp>/<run>/{metrics,params}
    candidates = {
        "metrics_path": os.path.join("mlruns", str(experiment_id), run_id, "metrics"),
        "params_path":  os.path.join("mlruns", str(experiment_id), run_id, "params"),
        "tags_path":    os.path.join("mlruns", str(experiment_id), run_id, "tags"),
    }
    for k, v in list(candidates.items()):
        candidates[k] = v if _path_exists(v) else None
    return candidates

def _parse_model_id_from_source(src: str) -> str | None:
    # e.g. file:/.../mlartifacts/models/m-4374b0.../MLmodel
    m = re.search(r"/models/(m-[^/]+)/?", src.replace("\\", "/"))
    return m.group(1) if m else None

# ----------------------------
# Train, Evaluate, Log
# ----------------------------
with mlflow.start_run(experiment_id=exp_id, run_name="xgb-train-with-metrics-and-save-current") as active:
    run = mlflow.active_run()
    run_id = run.info.run_id

    # Params
    mlflow.log_params({
        "model": "XGBClassifier",
        "n_estimators": xgb.n_estimators,
        "max_depth": xgb.max_depth,
        "learning_rate": xgb.learning_rate,
        "subsample": xgb.subsample,
        "colsample_bytree": xgb.colsample_bytree,
        "reg_lambda": xgb.reg_lambda,
        "random_state": RANDOM_STATE,
        "scale_pos_weight": scale_pos_weight,
        "categorical_cols": ",".join(categorical_cols),
        "numeric_cols": ",".join(numeric_cols),
        "data_path": DATA_PATH,
        "target": TARGET_COL,
        "test_size": TEST_SIZE,
    })

    # Fit & evaluate
    pipe.fit(X_train, y_train)
    y_pred = pipe.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred, zero_division=0)
    rec = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    mlflow.log_metrics({"accuracy": acc, "precision": prec, "recall": rec, "f1": f1})

    # Persist the training code
    mlflow.log_artifact(__file__, artifact_path="code")

    # Save the CURRENT model (+ signature & input example)
    input_example = X_train.head(5).copy()
    try:
        signature = infer_signature(input_example, pipe.predict(input_example))
    except Exception:
        signature = None

    model_info = mlflow.sklearn.log_model(
        sk_model=pipe,
        artifact_path="model",
        signature=signature,
        input_example=input_example,
        registered_model_name=REGISTERED_MODEL_NAME if REGISTERED_MODEL_NAME else None,
    )

    # Optional: alias "current" and move to Staging
    created_version = None
    try:
        if REGISTERED_MODEL_NAME:
            versions = client.search_model_versions(
                f"name='{REGISTERED_MODEL_NAME}' and run_id='{run_id}'"
            )
            if versions:
                created_version = max(int(v.version) for v in versions)
                client.set_registered_model_alias(
                    name=REGISTERED_MODEL_NAME, alias="current", version=created_version
                )
                try:
                    client.transition_model_version_stage(
                        name=REGISTERED_MODEL_NAME, version=created_version,
                        stage="Staging", archive_existing_versions=False,
                    )
                except Exception:
                    pass
    except Exception as e:
        print(f"Registry aliasing skipped: {e}")

    # Try to gather model source + (if we can) model_id + storage_location
    model_source = None
    model_id = None
    storage_location = None
    if created_version is not None:
        try:
            mv = client.get_model_version(REGISTERED_MODEL_NAME, str(created_version))
            model_source = getattr(mv, "source", None)
            storage_location = getattr(mv, "storage_location", None) or model_source
            if model_source:
                model_id = _parse_model_id_from_source(model_source)
        except Exception:
            pass

    # Feature names artifact (optional)
    try:
        if len(categorical_cols) > 0 and isinstance(pipe.named_steps.get("prep"), ColumnTransformer):
            ohe = pipe.named_steps["prep"].named_transformers_["cat"]
            cat_feature_names = ohe.get_feature_names_out(categorical_cols).tolist()
            final_feature_names = cat_feature_names + numeric_cols
        else:
            final_feature_names = numeric_cols
        pd.Series(final_feature_names, name="feature").to_csv("final_feature_names.csv", index=False)
        mlflow.log_artifact("final_feature_names.csv")
        os.remove("final_feature_names.csv")
    except Exception:
        pass

    # ----------------------------
    # INDEXING (public + private)
    # ----------------------------
    # Slugs (safe for UI)
    exp_slug  = _slug("exp", EXPERIMENT_NAME or str(exp_id))
    run_slug  = _slug("run", run_id)
    model_slug = _slug("mdl", (model_id or f"{REGISTERED_MODEL_NAME or 'model'}-v{created_version or 'NA'}"))

    # Artifact URI (logical pointer)
    artifact_uri = client.get_run(run_id).info.artifact_uri  # e.g. file:/.../mlartifacts/<exp>/<run>/artifacts

    # Try to guess metrics/params paths (works for file-backed stores)
    guessed = _guess_metrics_params_paths(run_id, exp_id)

    # PUBLIC CSV (safe for frontend)
    public_row = {
        "experiment_slug": exp_slug,
        "experiment_name": EXPERIMENT_NAME,
        "run_slug": run_slug,
        "run_name": "xgb-train-with-metrics-and-save-current",
        "model_slug": model_slug,
        "model_name": REGISTERED_MODEL_NAME or "",
        "model_version": created_version or "",
        # Only safe summary info here:
        "metrics_json": json.dumps({"accuracy": acc, "precision": prec, "recall": rec, "f1": f1}),
    }
    pub_df = pd.DataFrame([public_row])
    pub_df.to_csv("public_run_index.csv", index=False)
    mlflow.log_artifact("public_run_index.csv", artifact_path="index")
    os.remove("public_run_index.csv")

    # PRIVATE JSON (backend only)
    private_payload = {
        "experiment": {
            "slug": exp_slug,
            "id": str(exp_id),
            "name": EXPERIMENT_NAME,
        },
        "run": {
            "slug": run_slug,
            "id": run_id,
            "artifact_uri": artifact_uri,
            "metrics_path": guessed["metrics_path"],
            "params_path": guessed["params_path"],
            "tags_path": guessed["tags_path"],
        },
        "model": {
            "slug": model_slug,
            "name": REGISTERED_MODEL_NAME,
            "version": created_version,
            "model_id": model_id,
            "source": model_source,
            "storage_location": storage_location,
        }
    }
    with open("private_run_index.json", "w", encoding="utf-8") as f:
        json.dump(private_payload, f, ensure_ascii=False, indent=2)
    mlflow.log_artifact("private_run_index.json", artifact_path="index")
    os.remove("private_run_index.json")

print("✅ Training complete. Logged MLflow artifacts, plus index/index(public+private).")
