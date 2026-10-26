# Personal Chef

A recipe assistant built with FastAPI, LangChain, DeepSeek, and a Next.js frontend. Chat about ingredients, upload images to S3, and revisit conversations saved in SQLite.

## Setup

Requirements: Python 3.11+, [uv](https://docs.astral.sh/uv/), Node.js 20.9+, npm, and AWS CLI.

Run these commands from the project root:

```bash
uv sync
cp .env.example .env
```

Edit `.env` with your API keys, bucket name, and bucket region:

```dotenv
DEEPSEEK_API_KEY=your-deepseek-api-key
TAVILY_API_KEY=your-tavily-api-key
S3_BUCKET=your-bucket-name
AWS_DEFAULT_REGION=us-east-1
AWS_PROFILE=chef-local
```

Configure the AWS profile once:

```bash
aws configure --profile chef-local
```

This stores AWS credentials in `~/.aws/credentials`. The profile needs `s3:PutObject` and `s3:GetObject` permissions for your bucket's objects. Keep credentials out of Git and the frontend.

Keep the bucket private. Its CORS rules must allow your frontend origin, `GET` and `PUT`, and the `Content-Type` header. Use `http://localhost:8001` for the built website or `http://localhost:3000` for frontend development. `127.0.0.1` requires separate CORS entries.

## Build the frontend

From the project root:

```bash
npm --prefix frontend ci
NEXT_PUBLIC_API_BASE_URL= npm --prefix frontend run build
mkdir -p app/static
cp -R frontend/out/. app/static/
```

Next.js exports to `frontend/out/`. Copy its complete contents, including `_next/`, into `app/static/` so FastAPI can serve the website. Rebuild and copy again after frontend changes.

## Run

Start the backend from the project root:

```bash
uv run python -m app.main
```

Open [the app](http://localhost:8001) or [the API docs](http://localhost:8001/docs). Start a conversation, optionally select an image, and send your message. Images upload to S3 before their signed URLs are sent to the model.

For frontend development, run `npm --prefix frontend run dev` in a second terminal and open [localhost:3000](http://localhost:3000). The frontend connects to the backend on port 8001 by default.

## Backend structure

Main files and runtime directories:

```text
app/
├── main.py                   # FastAPI entry point and static file hosting
├── agents/
│   └── personal_chief.py     # Recipe agent and streaming model responses
├── api/v1/
│   ├── chat.py               # Conversation list, history, streaming, and clearing
│   └── oss.py                # S3 upload and download signing
├── common/
│   ├── chat_history.py       # Read and clear SQLite conversation checkpoints
│   └── logger.py             # Logging setup
├── models/
│   └── schemas.py            # API request and response models
├── db/                       # Local SQLite data
└── static/                   # Compiled frontend files
```

The SQLite database and compiled frontend files are excluded from Git.
