# Tools

All Python in this repository lives here, sharing one virtual environment and one dependency list.
The website does not depend on anything in this folder.

| Folder | What it does |
| --- | --- |
| [`template/`](template/) | Builds the content-calendar workbook each brand fills in. `make_sample.py` builds a made-up one for the website's tests |

## Set up (once)

From the repository root:

```bash
cd tools
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

In any new terminal, run `cd tools` and `source .venv/bin/activate` before using a script.
`deactivate` switches the environment off.

## Adding a tool

Put it in its own subfolder here, add any new library to `requirements.txt` with an exact version,
and add a row to the table above.
