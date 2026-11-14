// Minimal accessibility bridge for Brave: dumps the AX tree (including WebUI once
// AXEnhancedUserInterface is on) and can press elements by name.
// usage:
//   ax <bundleId> dump [maxDepth]
//   ax <bundleId> press <substring>
//   ax <bundleId> click <x> <y>
import Foundation
import ApplicationServices
import AppKit

let args = CommandLine.arguments
guard args.count >= 3 else {
  print("usage: ax <bundleId> dump|press|click ...")
  exit(2)
}
let bundleId = args[1]
let command = args[2]

guard let app = NSRunningApplication.runningApplications(withBundleIdentifier: bundleId).first else {
  print("app not running: \(bundleId)")
  exit(1)
}
let pid = app.processIdentifier
let appEl = AXUIElementCreateApplication(pid)

if command == "scroll" {
  let sx = Double(args[3]) ?? 700
  let sy = Double(args[4]) ?? 500
  let dy = Int32(args[5] ?? "-600") ?? -600
  let move = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: CGPoint(x: sx, y: sy), mouseButton: .left)!
  move.post(tap: .cghidEventTap)
  usleep(80_000)
  for _ in 0..<6 {
    let scroll = CGEvent(scrollWheelEvent2Source: nil, units: .pixel, wheelCount: 1, wheel1: dy / 6, wheel2: 0, wheel3: 0)!
    scroll.location = CGPoint(x: sx, y: sy)
    scroll.post(tap: .cghidEventTap)
    usleep(40_000)
  }
  print("scrolled \(dy) at \(Int(sx)),\(Int(sy))")
  exit(0)
}

func copyAttr(_ el: AXUIElement, _ name: CFString) -> CFTypeRef? {
  var value: CFTypeRef?
  let err = AXUIElementCopyAttributeValue(el, name, &value)
  return err == .success ? value : nil
}

func text(_ el: AXUIElement, _ name: CFString) -> String? {
  guard let v = copyAttr(el, name) else { return nil }
  if let s = v as? String, !s.isEmpty { return s }
  return nil
}

func children(_ el: AXUIElement) -> [AXUIElement] {
  guard let v = copyAttr(el, kAXChildrenAttribute as CFString) else { return [] }
  return (v as? [AXUIElement]) ?? []
}

func frame(_ el: AXUIElement) -> CGRect? {
  var pos = CGPoint.zero
  var size = CGSize.zero
  if let p = copyAttr(el, kAXPositionAttribute as CFString) {
    AXValueGetValue(p as! AXValue, .cgPoint, &pos)
  }
  if let s = copyAttr(el, kAXSizeAttribute as CFString) {
    AXValueGetValue(s as! AXValue, .cgSize, &size)
  }
  if size.width == 0 && size.height == 0 { return nil }
  return CGRect(origin: pos, size: size)
}

AXUIElementSetAttributeValue(appEl, "AXEnhancedUserInterface" as CFString, kCFBooleanTrue)
AXUIElementSetAttributeValue(appEl, "AXManualAccessibility" as CFString, kCFBooleanTrue)
for window in (copyAttr(appEl, kAXWindowsAttribute as CFString) as? [AXUIElement]) ?? [] {
  AXUIElementSetAttributeValue(window, "AXEnhancedUserInterface" as CFString, kCFBooleanTrue)
  AXUIElementSetAttributeValue(window, "AXManualAccessibility" as CFString, kCFBooleanTrue)
}
usleep(1_200_000)

let maxDepth = command == "dump" ? Int(args.count > 3 ? args[3] : "40") ?? 40 : 40

var visited = 0
func dump(_ el: AXUIElement, _ depth: Int) {
  guard depth <= maxDepth, visited < 2500 else { return }
  visited += 1
  let role = text(el, kAXRoleAttribute as CFString) ?? "?"
  let title = text(el, kAXTitleAttribute as CFString) ?? ""
  let desc = text(el, kAXDescriptionAttribute as CFString) ?? ""
  let value = text(el, kAXValueAttribute as CFString) ?? ""
  let help = text(el, kAXHelpAttribute as CFString) ?? ""
  if !title.isEmpty || !desc.isEmpty || !value.isEmpty || !help.isEmpty || role.contains("Button") || role.contains("Check") || role.contains("Text") {
    let f = frame(el)
    let box = f.map { "[\(Int($0.minX)),\(Int($0.minY)) \(Int($0.width))x\(Int($0.height))]" } ?? ""
    print("\(String(repeating: "  ", count: min(depth, 12)))\(role) | t=\(title) | d=\(desc) | v=\(value) | h=\(help) \(box)")
  }
  for child in children(el) { dump(child, depth + 1) }
}

var found: AXUIElement?
var anchorElement: AXUIElement?
func search(_ el: AXUIElement, _ needle: String, _ depth: Int) {
  guard found == nil, depth <= 30 else { return }
  let role = text(el, kAXRoleAttribute as CFString) ?? ""
  let candidates = [
    text(el, kAXTitleAttribute as CFString),
    text(el, kAXDescriptionAttribute as CFString),
    text(el, kAXValueAttribute as CFString),
    text(el, kAXHelpAttribute as CFString),
  ].compactMap { $0 }
  if candidates.contains(where: { $0.lowercased().contains(needle.lowercased()) }) || role.lowercased().contains(needle.lowercased()) {
    found = el
    return
  }
  for child in children(el) { search(child, needle, depth + 1) }
}

func findIn(_ el: AXUIElement, _ needle: String, _ depth: Int, _ maxDepth: Int = 12) -> AXUIElement? {
  if depth > maxDepth { return nil }
  let role = text(el, kAXRoleAttribute as CFString) ?? ""
  let candidates = [
    text(el, kAXTitleAttribute as CFString),
    text(el, kAXDescriptionAttribute as CFString),
    text(el, kAXValueAttribute as CFString),
  ].compactMap { $0 }
  if role.contains("Button") && candidates.contains(where: { $0.lowercased().contains(needle.lowercased()) }) {
    // only accept controls physically near the anchor
    if let anchorEl = anchorElement, let anchorFrame = frame(anchorEl), let buttonFrame = frame(el) {
      let dx = abs(buttonFrame.midX - anchorFrame.midX)
      let dy = abs(buttonFrame.midY - anchorFrame.midY)
      if dx > 260 || dy > 200 { return nil }
    }
    return el
  }
  for child in children(el) {
    if let hit = findIn(child, needle, depth + 1, maxDepth) { return hit }
  }
  return nil
}

switch command {
case "pressin":
  let anchor = args.count > 3 ? args[3] : ""
  let target = args.count > 4 ? args[4] : ""
  search(appEl, anchor, 0)
  guard var node = found else { print("anchor not found: \(anchor)"); exit(3) }
  anchorElement = node
  for _ in 0..<8 {
    if let button = findIn(node, target, 0) {
      let err = AXUIElementPerformAction(button, kAXPressAction as CFString)
      print(err == .success ? "pressed \(target) inside \(anchor)" : "press failed (\(err.rawValue))")
      exit(0)
    }
    if let parent = copyAttr(node, kAXParentAttribute as CFString) {
      node = parent as! AXUIElement
    } else { break }
  }
  print("target not found: \(target)")
  exit(3)
case "dump":
  dump(appEl, 0)
case "press":
  let needle = args.count > 3 ? args[3] : ""
  search(appEl, needle, 0)
  if let target = found {
    let err = AXUIElementPerformAction(target, kAXPressAction as CFString)
    let label = text(target, kAXTitleAttribute as CFString) ?? text(target, kAXDescriptionAttribute as CFString) ?? needle
    print(err == .success ? "pressed: \(label)" : "press failed (\(err.rawValue)): \(label)")
  } else {
    print("not found: \(needle)")
    exit(3)
  }
case "click":
  let x = Double(args[3]) ?? 0
  let y = Double(args[4]) ?? 0
  var hit: AXUIElement?
  AXUIElementCopyElementAtPosition(appEl, Float(x), Float(y), &hit)
  // Real click through the event system, at the requested screen point.
  let loc = CGPoint(x: x, y: y)
  let down = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: loc, mouseButton: .left)!
  let up = CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: loc, mouseButton: .left)!
  down.post(tap: .cghidEventTap)
  usleep(60_000)
  up.post(tap: .cghidEventTap)
  let role = hit.flatMap { text($0, kAXRoleAttribute as CFString) } ?? "?"
  let title = hit.flatMap { text($0, kAXTitleAttribute as CFString) } ?? ""
  let desc = hit.flatMap { text($0, kAXDescriptionAttribute as CFString) } ?? ""
  print("clicked \(Int(x)),\(Int(y)) -> \(role) \(title) \(desc)")
case "probe":
  let px = Double(args[3]) ?? 0
  let py = Double(args[4]) ?? 0
  var el: AXUIElement?
  AXUIElementCopyElementAtPosition(appEl, Float(px), Float(py), &el)
  guard var cur = el else { print("nothing at point"); exit(3) }
  for level in 0..<8 {
    let role = text(cur, kAXRoleAttribute as CFString) ?? "?"
    let title = text(cur, kAXTitleAttribute as CFString) ?? ""
    let desc = text(cur, kAXDescriptionAttribute as CFString) ?? ""
    let value = copyAttr(cur, kAXValueAttribute as CFString).map { "\($0)" } ?? ""
    let f = frame(cur).map { "[\(Int($0.minX)),\(Int($0.minY)) \(Int($0.width))x\(Int($0.height))]" } ?? ""
    print("\(level) \(role) | t=\(title) | d=\(desc) | v=\(value) \(f) kids=\(children(cur).count)")
    if let parent = copyAttr(cur, kAXParentAttribute as CFString) {
      cur = parent as! AXUIElement
    } else { break }
  }
case "dumpat":
  let dx = Double(args[3]) ?? 0
  let dy = Double(args[4]) ?? 0
  var el: AXUIElement?
  AXUIElementCopyElementAtPosition(appEl, Float(dx), Float(dy), &el)
  if let start = el { dump(start, 0) } else { print("nothing at point") }
case "raise":
  let needle = args.count > 3 ? args[3] : ""
  let windows = (copyAttr(appEl, kAXWindowsAttribute as CFString) as? [AXUIElement]) ?? []
  var matched = false
  for window in windows {
    let title = text(window, kAXTitleAttribute as CFString) ?? ""
    if title.lowercased().contains(needle.lowercased()) {
      AXUIElementSetAttributeValue(window, kAXMainAttribute as CFString, kCFBooleanTrue)
      AXUIElementPerformAction(window, kAXRaiseAction as CFString)
      matched = true
      print("raised: \(title)")
    }
  }
  if !matched { print("no window matching \(needle)"); exit(3) }
case "windows":
  let windows = (copyAttr(appEl, kAXWindowsAttribute as CFString) as? [AXUIElement]) ?? []
  for window in windows {
    let title = text(window, kAXTitleAttribute as CFString) ?? ""
    let f = frame(window).map { "[\(Int($0.minX)),\(Int($0.minY)) \(Int($0.width))x\(Int($0.height))]" } ?? ""
    let main = copyAttr(window, kAXMainAttribute as CFString).map { "\($0)" } ?? ""
    print("\(title) \(f) main=\(main)")
  }
default:
  print("unknown command")
  exit(2)
}
