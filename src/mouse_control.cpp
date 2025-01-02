#include "mouse_control.h"

#ifdef _WIN32
#include <windows.h>
#elif __APPLE__
#include <ApplicationServices/ApplicationServices.h>
#endif

void MouseControl::MoveTo(int x, int y) {
#ifdef _WIN32
    SetCursorPos(x, y);
#elif __APPLE__
    CGPoint point = CGPointMake(x, y);
    CGEventRef event = CGEventCreateMouseEvent(
        nullptr, kCGEventMouseMoved, point, kCGMouseButtonLeft);
    CGEventPost(kCGHIDEventTap, event);
    CFRelease(event);
#endif
}

void MouseControl::Click() {
#ifdef _WIN32
    INPUT input = {0};
    input.type = INPUT_MOUSE;
    input.mi.dwFlags = MOUSEEVENTF_LEFTDOWN;
    SendInput(1, &input, sizeof(INPUT));
    
    input.mi.dwFlags = MOUSEEVENTF_LEFTUP;
    SendInput(1, &input, sizeof(INPUT));
#elif __APPLE__
    CGPoint point;
    CGEventRef click = CGEventCreate(nullptr);
    point = CGEventGetLocation(click);
    CFRelease(click);
    
    CGEventRef mouseDown = CGEventCreateMouseEvent(
        nullptr, kCGEventLeftMouseDown, point, kCGMouseButtonLeft);
    CGEventRef mouseUp = CGEventCreateMouseEvent(
        nullptr, kCGEventLeftMouseUp, point, kCGMouseButtonLeft);
    
    CGEventPost(kCGHIDEventTap, mouseDown);
    CGEventPost(kCGHIDEventTap, mouseUp);
    
    CFRelease(mouseDown);
    CFRelease(mouseUp);
#endif
}

void MouseControl::GetPosition(int& x, int& y) {
#ifdef _WIN32
    POINT p;
    GetCursorPos(&p);
    x = p.x;
    y = p.y;
#elif __APPLE__
    CGEventRef event = CGEventCreate(nullptr);
    CGPoint point = CGEventGetLocation(event);
    CFRelease(event);
    x = (int)point.x;
    y = (int)point.y;
#endif
} 
