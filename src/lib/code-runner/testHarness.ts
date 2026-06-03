// This file builds static harness source. It never interpolates shell commands,
// and the only interpolated value is a validated Python identifier.

export function buildPythonHarnessSource(functionName: string): string {
  return String.raw`
import contextlib
import builtins
import importlib.util
import io
import json
import os
import socket
import sys
import time
import traceback

CAP = 10000
ROOT = os.getcwd()
REAL_OPEN = builtins.open
REAL_OS_OPEN = os.open
REAL_IMPORT = builtins.__import__
REAL_OS_ACCESS = os.access
REAL_OS_LISTDIR = os.listdir
REAL_OS_MKDIR = os.mkdir
REAL_OS_MAKEDIRS = os.makedirs
REAL_OS_REMOVE = os.remove
REAL_OS_RMDIR = os.rmdir
REAL_OS_SCANDIR = os.scandir
REAL_OS_STAT = os.stat
REAL_OS_UNLINK = os.unlink
BLOCKED_MODULE_ROOTS = {
    "asyncio",
    "ctypes",
    "ftplib",
    "http",
    "importlib",
    "multiprocessing",
    "pathlib",
    "pkgutil",
    "requests",
    "resource",
    "shutil",
    "ssl",
    "subprocess",
    "urllib",
}

def deny_network(*args, **kwargs):
    raise RuntimeError("Network access is disabled in PatternForge code runs.")

def deny_process(*args, **kwargs):
    raise RuntimeError("Process creation is disabled in PatternForge code runs.")

def safe_path(file):
    if not isinstance(file, (str, bytes, os.PathLike)):
        return file
    real_path = os.path.realpath(os.fspath(file))
    if real_path == ROOT or real_path.startswith(ROOT + os.sep):
        return file
    raise PermissionError("File access is limited to the temporary run directory.")

def guarded_open(file, *args, **kwargs):
    return REAL_OPEN(safe_path(file), *args, **kwargs)

def guarded_os_open(file, flags, mode=0o777, *args, **kwargs):
    return REAL_OS_OPEN(safe_path(file), flags, mode, *args, **kwargs)

def guarded_import(name, globals=None, locals=None, fromlist=(), level=0):
    root = name.split(".", 1)[0]
    if root in BLOCKED_MODULE_ROOTS:
        raise ImportError(f"Module {root} is disabled in PatternForge code runs.")
    return REAL_IMPORT(name, globals, locals, fromlist, level)

def sanitize_error(value):
    return truncate(value.replace(ROOT, "<run-dir>"))

socket.socket = deny_network
socket.create_connection = deny_network
builtins.open = guarded_open
builtins.__import__ = guarded_import
os.open = guarded_os_open
os.access = lambda path, *args, **kwargs: REAL_OS_ACCESS(safe_path(path), *args, **kwargs)
os.listdir = lambda path=".", *args, **kwargs: REAL_OS_LISTDIR(safe_path(path), *args, **kwargs)
os.mkdir = lambda path, *args, **kwargs: REAL_OS_MKDIR(safe_path(path), *args, **kwargs)
os.makedirs = lambda name, *args, **kwargs: REAL_OS_MAKEDIRS(safe_path(name), *args, **kwargs)
os.remove = lambda path, *args, **kwargs: REAL_OS_REMOVE(safe_path(path), *args, **kwargs)
os.rmdir = lambda path, *args, **kwargs: REAL_OS_RMDIR(safe_path(path), *args, **kwargs)
os.scandir = lambda path=".", *args, **kwargs: REAL_OS_SCANDIR(safe_path(path), *args, **kwargs)
os.stat = lambda path, *args, **kwargs: REAL_OS_STAT(safe_path(path), *args, **kwargs)
os.unlink = lambda path, *args, **kwargs: REAL_OS_UNLINK(safe_path(path), *args, **kwargs)
for name in ("execl", "execle", "execlp", "execlpe", "execv", "execve", "execvp", "execvpe", "fork", "forkpty", "popen", "posix_spawn", "posix_spawnp", "spawnl", "spawnle", "spawnlp", "spawnlpe", "spawnv", "spawnve", "spawnvp", "spawnvpe", "system"):
    if hasattr(os, name):
        setattr(os, name, deny_process)

def truncate(value):
    if len(value) <= CAP:
        return value
    return value[: CAP - 48] + "\n...[truncated by PatternForge output limit]"

def jsonable(value):
    try:
        json.dumps(value)
        return value
    except Exception:
        return repr(value)

def load_solution():
    spec = importlib.util.spec_from_file_location("patternforge_solution", "solution.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def call_args(input_json):
    if isinstance(input_json, list):
        return input_json
    return [input_json]

def run():
    payload = json.loads(sys.stdin.read() or "{}")
    tests = payload.get("tests", [])

    try:
        module = load_solution()
        target = getattr(module, "${functionName}")
        if not callable(target):
            raise TypeError("${functionName} is not callable")
    except Exception:
        print(json.dumps({
            "status": "RuntimeError",
            "stdout": "",
            "stderr": "",
            "errorMessage": sanitize_error(traceback.format_exc()),
            "testResults": [],
        }))
        return

    all_stdout = []
    all_stderr = []
    test_results = []

    for test in tests:
        stdout_buffer = io.StringIO()
        stderr_buffer = io.StringIO()
        started = time.perf_counter()
        try:
            with contextlib.redirect_stdout(stdout_buffer), contextlib.redirect_stderr(stderr_buffer):
                actual = target(*call_args(test.get("inputJson")))
            runtime_ms = int((time.perf_counter() - started) * 1000)
            stdout = truncate(stdout_buffer.getvalue())
            stderr = truncate(stderr_buffer.getvalue())
            all_stdout.append(stdout)
            all_stderr.append(stderr)
            actual_json = jsonable(actual)
            expected_json = test.get("expectedOutputJson")
            test_results.append({
                "testCaseId": test.get("testCaseId"),
                "name": test.get("name", "Unnamed test"),
                "inputJson": test.get("inputJson"),
                "expectedOutputJson": expected_json,
                "actualOutputJson": actual_json,
                "passed": actual_json == expected_json,
                "stdout": stdout,
                "stderr": stderr,
                "runtimeMs": runtime_ms,
            })
        except Exception:
            runtime_ms = int((time.perf_counter() - started) * 1000)
            stdout = truncate(stdout_buffer.getvalue())
            stderr = truncate(stderr_buffer.getvalue())
            all_stdout.append(stdout)
            all_stderr.append(stderr)
            test_results.append({
                "testCaseId": test.get("testCaseId"),
                "name": test.get("name", "Unnamed test"),
                "inputJson": test.get("inputJson"),
                "expectedOutputJson": test.get("expectedOutputJson"),
                "passed": False,
                "stdout": stdout,
                "stderr": stderr,
                "errorMessage": sanitize_error(traceback.format_exc()),
                "runtimeMs": runtime_ms,
            })

    has_error = any(result.get("errorMessage") for result in test_results)
    status = "RuntimeError" if has_error else ("Succeeded" if all(result.get("passed") for result in test_results) else "Failed")
    print(json.dumps({
        "status": status,
        "stdout": truncate("".join(all_stdout)),
        "stderr": truncate("".join(all_stderr)),
        "testResults": test_results,
    }))

run()
`;
}

export function buildPythonFreeRunHarnessSource(): string {
  return String.raw`
import contextlib
import builtins
import io
import json
import os
import runpy
import socket
import traceback

CAP = 10000
ROOT = os.getcwd()
REAL_OPEN = builtins.open
REAL_OS_OPEN = os.open
REAL_IMPORT = builtins.__import__
REAL_OS_ACCESS = os.access
REAL_OS_LISTDIR = os.listdir
REAL_OS_MKDIR = os.mkdir
REAL_OS_MAKEDIRS = os.makedirs
REAL_OS_REMOVE = os.remove
REAL_OS_RMDIR = os.rmdir
REAL_OS_SCANDIR = os.scandir
REAL_OS_STAT = os.stat
REAL_OS_UNLINK = os.unlink
BLOCKED_MODULE_ROOTS = {
    "asyncio",
    "ctypes",
    "ftplib",
    "http",
    "importlib",
    "multiprocessing",
    "pathlib",
    "pkgutil",
    "requests",
    "resource",
    "shutil",
    "ssl",
    "subprocess",
    "urllib",
}

def deny_network(*args, **kwargs):
    raise RuntimeError("Network access is disabled in PatternForge code runs.")

def deny_process(*args, **kwargs):
    raise RuntimeError("Process creation is disabled in PatternForge code runs.")

def safe_path(file):
    if not isinstance(file, (str, bytes, os.PathLike)):
        return file
    real_path = os.path.realpath(os.fspath(file))
    if real_path == ROOT or real_path.startswith(ROOT + os.sep):
        return file
    raise PermissionError("File access is limited to the temporary run directory.")

def guarded_open(file, *args, **kwargs):
    return REAL_OPEN(safe_path(file), *args, **kwargs)

def guarded_os_open(file, flags, mode=0o777, *args, **kwargs):
    return REAL_OS_OPEN(safe_path(file), flags, mode, *args, **kwargs)

def guarded_import(name, globals=None, locals=None, fromlist=(), level=0):
    root = name.split(".", 1)[0]
    if root in BLOCKED_MODULE_ROOTS:
        raise ImportError(f"Module {root} is disabled in PatternForge code runs.")
    return REAL_IMPORT(name, globals, locals, fromlist, level)

def sanitize_error(value):
    return truncate(value.replace(ROOT, "<run-dir>"))

socket.socket = deny_network
socket.create_connection = deny_network
builtins.open = guarded_open
builtins.__import__ = guarded_import
os.open = guarded_os_open
os.access = lambda path, *args, **kwargs: REAL_OS_ACCESS(safe_path(path), *args, **kwargs)
os.listdir = lambda path=".", *args, **kwargs: REAL_OS_LISTDIR(safe_path(path), *args, **kwargs)
os.mkdir = lambda path, *args, **kwargs: REAL_OS_MKDIR(safe_path(path), *args, **kwargs)
os.makedirs = lambda name, *args, **kwargs: REAL_OS_MAKEDIRS(safe_path(name), *args, **kwargs)
os.remove = lambda path, *args, **kwargs: REAL_OS_REMOVE(safe_path(path), *args, **kwargs)
os.rmdir = lambda path, *args, **kwargs: REAL_OS_RMDIR(safe_path(path), *args, **kwargs)
os.scandir = lambda path=".", *args, **kwargs: REAL_OS_SCANDIR(safe_path(path), *args, **kwargs)
os.stat = lambda path, *args, **kwargs: REAL_OS_STAT(safe_path(path), *args, **kwargs)
os.unlink = lambda path, *args, **kwargs: REAL_OS_UNLINK(safe_path(path), *args, **kwargs)
for name in ("execl", "execle", "execlp", "execlpe", "execv", "execve", "execvp", "execvpe", "fork", "forkpty", "popen", "posix_spawn", "posix_spawnp", "spawnl", "spawnle", "spawnlp", "spawnlpe", "spawnv", "spawnve", "spawnvp", "spawnvpe", "system"):
    if hasattr(os, name):
        setattr(os, name, deny_process)

def truncate(value):
    if len(value) <= CAP:
        return value
    return value[: CAP - 48] + "\n...[truncated by PatternForge output limit]"

stdout_buffer = io.StringIO()
stderr_buffer = io.StringIO()

try:
    with contextlib.redirect_stdout(stdout_buffer), contextlib.redirect_stderr(stderr_buffer):
        runpy.run_path("solution.py", run_name="__main__")
    print(json.dumps({
        "status": "Succeeded",
        "stdout": truncate(stdout_buffer.getvalue()),
        "stderr": truncate(stderr_buffer.getvalue()),
        "testResults": [],
    }))
except Exception:
    print(json.dumps({
        "status": "RuntimeError",
        "stdout": truncate(stdout_buffer.getvalue()),
        "stderr": truncate(stderr_buffer.getvalue()),
        "errorMessage": sanitize_error(traceback.format_exc()),
        "testResults": [],
    }))
`;
}
