#!/bin/bash
echo "================================"
echo "  BetaTesterAI — Installing"
echo "================================"

if ! command -v node &> /dev/null; then
  echo "❌ Node.js is not installed. Download it from https://nodejs.org"
  exit 1
fi

NODE_VER=$(node -e "process.exit(parseInt(process.versions.node.split('.')[0]) < 18 ? 1 : 0)" 2>/dev/null; echo $?)
if [ "$NODE_VER" != "0" ]; then
  echo "❌ Node.js 18+ is required. Your version: $(node --version)"
  exit 1
fi

echo "✅ Node.js $(node --version) found"
echo ""
echo "📦 Installing dependencies..."
npm install

echo ""
echo "🌐 Installing Chromium browser..."
npx playwright install chromium

echo ""
echo "================================"
echo "  ✅ Installation complete!"
echo "================================"
echo ""
echo "To start BetaTesterAI, run:"
echo "  ./start.sh"
echo ""
echo "Then open: http://localhost:3747"
