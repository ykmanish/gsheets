"""Use native Word for conversion, then the packaged DOCX renderer for raster QA.

The bundled renderer's LibreOffice conversion is unavailable on this Windows host.
Only the conversion function is replaced; rendering still processes the actual DOCX.
"""
import importlib.util
import os
from pathlib import Path
import subprocess
import sys

HERE = Path(__file__).resolve().parent
RENDERER = Path(r'C:\Users\my792\.codex\plugins\cache\openai-primary-runtime\documents\26.921.11914\skills\documents\render_docx.py')
POPPLER = r'C:\Users\my792\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\poppler\Library\bin'
os.environ['PATH'] = POPPLER + os.pathsep + os.environ['PATH']
spec = importlib.util.spec_from_file_location('bundled_docx_renderer', RENDERER)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

def word_convert(doc_path, user_profile, convert_tmp_dir, stem, verbose):
    output = str(Path(convert_tmp_dir) / (stem + '.pdf'))
    command = ['powershell.exe', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', str(HERE / 'export_word_pdf.ps1'), '-InputDocx', str(Path(doc_path).resolve()), '-OutputPdf', output]
    proc = subprocess.run(command, capture_output=True, text=True, timeout=90, creationflags=subprocess.CREATE_NO_WINDOW)
    log = proc.stdout + proc.stderr
    print(log.strip())
    if proc.returncode != 0 or not Path(output).is_file():
        raise RuntimeError('Word conversion failed: ' + log)
    return output, log

mod.convert_to_pdf = word_convert
mod.main()
