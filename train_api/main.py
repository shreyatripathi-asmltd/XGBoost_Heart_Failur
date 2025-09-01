import os, sys, tempfile, subprocess
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

# Allow your UI origin; during dev you can keep "*" but restrict in prod
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],         # e.g. ["http://localhost:5173"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CompileReq(BaseModel):
    code: str

@app.post("/compile")
def compile_code(req: CompileReq):
    """Syntax-check Python without executing it."""
    try:
        compile(req.code, "<string>", "exec")
        return {"ok": True}
    except SyntaxError as e:
        return {"ok": False, "error": f"SyntaxError: {e}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

@app.post("/train")
def train(
    experiment_id: str = Form(...),
    run_name: str = Form("manual-run"),
    code: UploadFile = File(...),
    data: UploadFile = File(...),
):
    """Run the uploaded Python with env vars so it logs to MLflow."""
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        code_path = td / (code.filename or "train.py")
        data_path = td / (data.filename or "data.csv")
        code_path.write_bytes(code.file.read())
        data_path.write_bytes(data.file.read())

        env = os.environ.copy()
        env.setdefault("MLFLOW_TRACKING_URI",
                       os.getenv("MLFLOW_TRACKING_URI", "http://127.0.0.1:5000"))
        env["MLFLOW_EXPERIMENT_ID"] = experiment_id
        env["TRAIN_DATA_PATH"] = str(data_path)
        env["RUN_NAME"] = run_name

        try:
            p = subprocess.run(
                [sys.executable, str(code_path)],
                cwd=td, env=env,
                capture_output=True, text=True, timeout=60*60, check=True
            )
            # If your script prints 'run_id=<id>' we’ll return it.
            run_id = ""
            for line in (p.stdout or "").splitlines():
                if "run_id=" in line:
                    run_id = line.split("run_id=")[-1].strip()
                    break
            return {"ok": True, "stdout": p.stdout, "stderr": p.stderr, "run_id": run_id}
        except subprocess.CalledProcessError as e:
            return {"ok": False, "error": e.stderr or str(e)}
