{
  "targets": [{
    "target_name": "mouse_control",
    "cflags!": [ "-fno-exceptions" ],
    "cflags_cc!": [ "-fno-exceptions" ],
    "sources": [
      "src/main.cpp",
      "src/mouse_control.cpp"
    ],
    "include_dirs": [
      "<!@(node -p \"require('node-addon-api').include\")"
    ],
    "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ],
    'conditions': [
      ['OS=="mac"', {
        'xcode_settings': {
          'GCC_ENABLE_CPP_EXCEPTIONS': 'YES'
        },
        'link_settings': {
          'libraries': [
            '-framework ApplicationServices'
          ]
        }
      }]
    ]
  }]
} 
