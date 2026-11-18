"""Install the pinned, relocatable native Windows development tools."""

from concurrent.futures import as_completed, ThreadPoolExecutor
from hashlib import file_digest, sha256
import json
import os
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[1]
LOCAL = ROOT / ".local"
CACHE = Path(os.environ["LOCALAPPDATA"]) / "CredWise360" / "archives"
LOCK = Path(__file__).with_name("windows-packages.lock.json")
MIRRORS = (
    "https://repo.msys2.org/mingw/ucrt64/",
    "https://mirror.msys2.org/mingw/ucrt64/",
)


def matches(path, expected):
    if not path.is_file():
        return False
    with path.open("rb") as stream:
        return file_digest(stream, "sha256").hexdigest() == expected


def download(pkg):
    filename = pkg["file"]
    target = CACHE / filename
    if matches(target, pkg["sha256"]):
        return target
    partial = CACHE / (filename + "." + str(os.getpid()) + ".part")
    for mirror in MIRRORS:
        run = subprocess.run([
            "curl.exe", "--fail", "--location", "--silent", "--show-error",
            "--connect-timeout", "12", "--retry", "2",
            "--output", partial, mirror + filename,
        ])
        if run.returncode == 0 and matches(partial, pkg["sha256"]):
            partial.replace(target)
            return target
    partial.unlink(missing_ok=True)
    raise RuntimeError(f"Unable to verify {filename} from the package mirrors.")


def main():
    LOCAL.mkdir(exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    stamp = LOCAL / "windows-tools.sha256"
    fingerprint = sha256(LOCK.read_bytes()).hexdigest()
    if stamp.is_file() and stamp.read_text().strip() == fingerprint:
        return
    packages = json.loads(LOCK.read_text())
    print(f"Installing {len(packages)} pinned native packages.", flush=True)
    with ThreadPoolExecutor(max_workers=7) as workers:
        downloads = [workers.submit(download, pkg) for pkg in packages]
        for ready in as_completed(downloads):
            archive = ready.result()
            # Virtual packages may contain only dot-prefixed manager metadata.
            subprocess.run(["tar.exe", "-xf", archive, "-C", LOCAL, "--exclude", ".*"], check=True)
    stamp.write_text(fingerprint + "\n")
    print("Windows tools installed and verified.", flush=True)


if __name__ == "__main__":
    main()
