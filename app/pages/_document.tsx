import * as React from 'react';

import Document, { Html, Head, Main, NextScript } from 'next/document'

class MyDocument extends Document {
  render() {
    return (
      <Html>
        <Head />
        <body>
          <script src="https://www.gstatic.com/firebasejs/7.14.4/firebase-app.js"></script>
          <script src="https://www.gstatic.com/firebasejs/7.14.4/firebase-analytics.js"></script>
          <script src="https://www.gstatic.com/firebasejs/7.14.4/firebase-auth.js"></script>
          <script src="https://www.gstatic.com/firebasejs/7.14.4/firebase-firestore.js"></script>
          <script src="https://www.gstatic.com/firebasejs/7.14.4/firebase-performance.js"></script>
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}

export default MyDocument
