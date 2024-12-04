---
layout: default
title: About
---

<!-- React 컴포넌트가 들어갈 위치 -->
<div id="about-page"></div>

<script>
  window.site = {
    about: {
      profile: {
        name: "Allen Kang",
        title: "Aspirant in Cognitive Science and Neuroscience",
        roles: [
          "Physics Imp",
          "Developing Patent Agent",
          "Future Science Communicator"
        ]
      }
    }
  };
</script>

<!-- Webpack 빌드된 React 코드 삽입 -->
<script src="{{ '/assets/js/dist/main.bundle.js' | relative_url }}"></script>
