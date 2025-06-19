#!/bin/bash

# High-frequency button clicker test script wrapper
# This script helps run the Python clicker with common configurations

echo "🚀 High-Frequency Button Clicker Test"
echo "======================================"

# Check if Python and pip are available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 is not installed. Please install Python3 first."
    exit 1
fi

# Check if selenium is installed, if not install it
if ! python3 -c "import selenium" &> /dev/null; then
    echo "📦 Installing Selenium..."
    pip3 install selenium
fi

# Check if ChromeDriver is available
if ! command -v chromedriver &> /dev/null; then
    echo "⚠️  ChromeDriver not found in PATH. Installing..."
    
    # Install ChromeDriver via apt if on Ubuntu/Debian
    if command -v apt-get &> /dev/null; then
        sudo apt-get update
        sudo apt-get install -y chromium-chromedriver
    else
        echo "❌ Please install ChromeDriver manually:"
        echo "   https://chromedriver.chromium.org/"
        exit 1
    fi
fi

echo ""
echo "🎯 Available test configurations:"
echo "1. Test localhost:3000 (React dev server)"
echo "2. Test localhost:5173 (Vite dev server)"
echo "3. Test localhost:8080 (Custom server)"
echo "4. Test custom URL"
echo "5. Quick test (10 clicks/sec for 5 seconds)"

read -p "Choose option (1-5): " choice

case $choice in
    1)
        URL="http://localhost:3000"
        ;;
    2)
        URL="http://localhost:5173"
        ;;
    3)
        URL="http://localhost:8080"
        ;;
    4)
        read -p "Enter URL: " URL
        ;;
    5)
        URL="http://localhost:5173"
        RATE=10
        DURATION=5
        ;;
    *)
        echo "Invalid choice. Using localhost:5173"
        URL="http://localhost:5173"
        ;;
esac

if [ -z "$RATE" ]; then
    read -p "Enter clicks per second (default: 100): " RATE
    RATE=${RATE:-100}
fi

if [ -z "$DURATION" ]; then
    read -p "Enter test duration in seconds (default: 10): " DURATION
    DURATION=${DURATION:-10}
fi

echo ""
echo "🎯 Common button selectors:"
echo "1. button (any button)"
echo "2. .btn or .button (class-based)"
echo "3. #submit-btn (ID-based)"
echo "4. [data-testid='click-button'] (test ID)"
echo "5. Custom selector"

read -p "Choose selector option (1-5): " selector_choice

case $selector_choice in
    1)
        SELECTOR="button"
        ;;
    2)
        SELECTOR=".btn"
        ;;
    3)
        SELECTOR="#submit-btn"
        ;;
    4)
        SELECTOR="[data-testid='click-button']"
        ;;
    5)
        read -p "Enter custom CSS selector: " SELECTOR
        ;;
    *)
        echo "Invalid choice. Using 'button'"
        SELECTOR="button"
        ;;
esac

echo ""
echo "🚀 Starting test with:"
echo "   URL: $URL"
echo "   Selector: $SELECTOR"
echo "   Rate: $RATE clicks/second"
echo "   Duration: $DURATION seconds"
echo ""
echo "Make sure your app is running at $URL"
read -p "Press Enter to start the test..."

# Run the Python script
python3 click_test.py "$URL" "$SELECTOR" --rate "$RATE" --duration "$DURATION"

