# SHAR (Scene History and Rendering) Installation Investigation

## Repository Information
- **Repository**: https://github.com/apple/ml-shar
- **Tool**: SHAR - Apple's Gaussian Splatting tool for 3D scene rendering

## Investigation Steps

### 1. Clone the Repository
```bash
git clone https://github.com/apple/ml-shar.git
cd ml-shar
```

### 2. Check README.md
The README should contain:
- Installation instructions
- System requirements
- Dependencies
- Build instructions
- Usage examples

### 3. Common Installation Patterns for Apple ML Tools

#### Python-based Installation
Most Apple ML tools use Python. Look for:
- `requirements.txt` or `pyproject.toml`
- `setup.py` or `setup.cfg`
- Conda environment files (`environment.yml`)

#### Typical Installation Steps:
```bash
# Option 1: Using pip
pip install -r requirements.txt
# or
pip install -e .

# Option 2: Using conda
conda env create -f environment.yml
conda activate shar-env

# Option 3: Using poetry (if pyproject.toml exists)
poetry install
```

### 4. System Dependencies to Check For
- **CUDA** (for GPU acceleration)
- **PyTorch** or **TensorFlow**
- **OpenCV** or other image processing libraries
- **FFmpeg** (for video processing)
- **CMake** (for C++ extensions)

### 5. Build Requirements
Check for:
- `CMakeLists.txt` (C++ compilation)
- `build.sh` or `build.py` scripts
- Native extensions that need compilation

### 6. Platform-Specific Notes
- **macOS**: May require Xcode Command Line Tools
- **Linux**: May need development packages
- **Windows**: May require Visual Studio Build Tools

## What to Document

After cloning, document:
1. ✅ Installation method (pip/conda/poetry)
2. ✅ Python version requirements
3. ✅ System dependencies
4. ✅ Build steps (if any)
5. ✅ Environment setup
6. ✅ Quick start example
7. ✅ Common issues and solutions

## Next Steps

Once you've cloned the repo, I can help you:
- Parse the README and requirements
- Create an installation script
- Set up a proper project structure
- Document the installation process
