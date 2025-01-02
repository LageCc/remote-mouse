#pragma once
#include <napi.h>

class MouseControl {
public:
    static void MoveTo(int x, int y);
    static void Click();
    static void GetPosition(int& x, int& y);
}; 
