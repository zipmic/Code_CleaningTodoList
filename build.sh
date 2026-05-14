#!/bin/bash
cd "$(dirname "$0")"
echo ""
echo " Building Cleanup Quest..."
echo ""
npm run build
if [ $? -eq 0 ]; then
    echo ""
    echo " Done! Opening the dist folder..."
    echo " Upload everything inside it to your FTP."
    echo ""
    open dist
else
    echo ""
    echo " Build failed! Read the errors above."
    read -p " Press Enter to close..."
fi
