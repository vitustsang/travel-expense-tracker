<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <title>Travel Tracker</title>
    
    <!-- Load React and Babel from CDN -->
    <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>

    <style>
        /* Prevents pull-to-refresh on iPhone which can be annoying in apps */
        body {
            overscroll-behavior-y: contain;
            background-color: #f3f4f6;
        }
    </style>
</head>
<body>
    <div id="root"></div>

    <!-- This script block loads your App.jsx and translates it on the fly -->
    <script type="text/babel" data-presets="react" src="App.jsx"></script>

    <script type="text/babel">
        // Basic error logging to help us if it still stays blank
        window.addEventListener('error', function(e) {
            console.error("Script error:", e.message);
        });
    </script>
</body>
</html>
