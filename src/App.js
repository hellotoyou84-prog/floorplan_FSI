// src/App.js
import React, { useEffect, useRef, useState, useCallback } from "react";
import { fabric } from "fabric";

export default function App() {
  const canvasRef = useRef(null);
  const canvasObj = useRef(null);
  const [mode, setMode] = useState(""); // "", "wall", "room", "door", "window", "outlet", "multitap", "breaker", "burn", "wire", "carbonized", "soot", "evidence"
  const [axisLock, setAxisLock] = useState(true);
  const [debugInfo, setDebugInfo] = useState(""); // 디버깅 정보 표시용
  const [showWires, setShowWires] = useState(true); // 전선 표시/숨김
  const [showCarbonized, setShowCarbonized] = useState(true); // 탄화면적 표시/숨김
  const [showSoot, setShowSoot] = useState(true); // 그을음피해 표시/숨김
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Canvas 초기화
  useEffect(() => {
    const canvasWidth = isMobile ? Math.min(window.innerWidth - 32, 400) : 800;
    const canvasHeight = isMobile ? Math.min(window.innerHeight - 300, 300) : 600;
    
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: canvasWidth,
      height: canvasHeight,
      backgroundColor: "#f3f3f3",
      selection: true,
      preserveObjectStacking: true, // 객체 선택 시 위로 올라가지 않도록 설정
      targetFindTolerance: 5, // 선택 허용 범위 확대 (특히 작은 객체용)
      perPixelTargetFind: true, // 픽셀 단위 정확한 선택
    });
    canvasObj.current = canvas;

    // Delete/Backspace로 삭제
    function handleKey(e) {
      if ((e.key === "Delete" || e.key === "Backspace") && canvas.getActiveObject()) {
        const sel = canvas.getActiveObject();
        if (sel.type === "activeSelection") {
          sel.forEachObject(o => canvas.remove(o));
        } else {
          canvas.remove(sel);
        }
        canvas.discardActiveObject();
        canvas.requestRenderAll();
      }
    }
    
    // 모바일 감지 및 리사이즈 처리
    function handleResize() {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      
      const newWidth = mobile ? Math.min(window.innerWidth - 32, 400) : 800;
      const newHeight = mobile ? Math.min(window.innerHeight - 300, 300) : 600;
      
      canvas.setDimensions({
        width: newWidth,
        height: newHeight
      });
    }
    
    window.addEventListener("keydown", handleKey);
    window.addEventListener("resize", handleResize);
    
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("resize", handleResize);
      canvas.off();
      canvas.clear();
    };
  }, [isMobile]);

  // 보조선 표시를 위한 함수 - 개선된 버전
  const showGuidelines = useCallback((mouseX, mouseY) => {
    const canvas = canvasObj.current;
    if (!canvas) return;
    
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    // 기존 보조선 제거
    canvas.getObjects().forEach(obj => {
      if (obj.isGuideline) {
        canvas.remove(obj);
      }
    });
    
    // 수직 보조선 (마우스 X좌표 기준)
    const verticalLine = new fabric.Line([mouseX, 0, mouseX, canvasHeight], {
      stroke: '#ff9800',
      strokeWidth: 1,
      strokeDashArray: [3, 3],
      selectable: false,
      evented: false,
      isGuideline: true,
    });
    canvas.add(verticalLine);
    
    // 수평 보조선 (마우스 Y좌표 기준)
    const horizontalLine = new fabric.Line([0, mouseY, canvasWidth, mouseY], {
      stroke: '#ff9800',
      strokeWidth: 1,
      strokeDashArray: [3, 3],
      selectable: false,
      evented: false,
      isGuideline: true,
    });
    canvas.add(horizontalLine);
    
    canvas.renderAll();
  }, []);

  // 벽의 실제 모서리 점들을 계산하는 함수 (개선된 버전)
  const getWallCornerPoints = useCallback((wall) => {
    const angle = (wall.angle || 0) * Math.PI / 180;
    const width = wall.width * (wall.scaleX || 1);
    const height = wall.height * (wall.scaleY || 1);
    
    // 벽의 중심점
    const centerX = wall.left;
    const centerY = wall.top;
    
    // 벽의 네 모서리 점 계산
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    
    // originX='left', originY='center'를 고려한 실제 모서리
    const halfHeight = height / 2;
    
    const corners = [
      // 시작점 상단
      {
        x: centerX - halfHeight * sin,
        y: centerY + halfHeight * cos,
        type: 'start'
      },
      // 시작점 하단  
      {
        x: centerX + halfHeight * sin,
        y: centerY - halfHeight * cos,
        type: 'start'
      },
      // 끝점 상단
      {
        x: centerX + width * cos - halfHeight * sin,
        y: centerY + width * sin + halfHeight * cos,
        type: 'end'
      },
      // 끝점 하단
      {
        x: centerX + width * cos + halfHeight * sin,
        y: centerY + width * sin - halfHeight * cos,
        type: 'end'
      }
    ];
    
    return corners;
  }, []);

  // 가장 가까운 스냅 포인트 찾기 (개선된 버전)
  const findSnapPoint = useCallback((mousePos, snapDistance = 15) => {
    const canvas = canvasObj.current;
    if (!canvas) return null;

    let closestPoint = null;
    let minDistance = snapDistance;

    // 모든 벽 객체 순회
    canvas.getObjects().forEach(obj => {
      if (obj.type === 'rect' && obj.height === 8) { // 벽 객체인지 확인
        const corners = getWallCornerPoints(obj);
        
        // 모든 모서리 점들을 확인
        corners.forEach(corner => {
          const distance = Math.hypot(mousePos.x - corner.x, mousePos.y - corner.y);
          if (distance < minDistance) {
            minDistance = distance;
            closestPoint = { x: corner.x, y: corner.y };
          }
        });
      }
    });

    return closestPoint;
  }, [getWallCornerPoints]);

  // 벽의 방향을 판단하는 함수 (수정됨)
  const getWallOrientation = useCallback((angle) => {
    const norm = ((angle % 360) + 360) % 360;
    
    // 수평: 0도±15, 180도±15 
    const isHorizontal = 
      (norm >= 345 || norm <= 15) || 
      (norm >= 165 && norm <= 195);
    
    // 수직: 90도±15, 270도±15
    const isVertical = 
      (norm >= 75 && norm <= 105) || 
      (norm >= 255 && norm <= 285);
    
    console.log(`벽 각도 분석: ${angle}° -> 정규화: ${norm}° -> 수평: ${isHorizontal}, 수직: ${isVertical}`);
    
    return { isHorizontal, isVertical, normalizedAngle: norm };
  }, []);

  // 방의 어느 변에 가까운지 판단하는 함수 추가
  const getRoomSideDirection = useCallback((room, clickX, clickY) => {
    // room의 실제 경계 계산 (transform 고려)
    const roomLeft = room.left;
    const roomTop = room.top;
    const roomRight = room.left + (room.width * (room.scaleX || 1));
    const roomBottom = room.top + (room.height * (room.scaleY || 1));
    
    // 각 변까지의 거리 계산
    const distanceToLeft = Math.abs(clickX - roomLeft);
    const distanceToRight = Math.abs(clickX - roomRight);
    const distanceToTop = Math.abs(clickY - roomTop);
    const distanceToBottom = Math.abs(clickY - roomBottom);
    
    // 가장 가까운 변 찾기
    const minDistance = Math.min(distanceToLeft, distanceToRight, distanceToTop, distanceToBottom);
    
    console.log('Room bounds:', { roomLeft, roomTop, roomRight, roomBottom });
    console.log('Click pos:', { clickX, clickY });
    console.log('Distances:', { distanceToLeft, distanceToRight, distanceToTop, distanceToBottom });
    console.log('Min distance:', minDistance);
    
    // 가장 가까운 변이 좌/우 변(세로변)이면 수직 방향 (문/창문이 세로로 길어짐)
    // 가장 가까운 변이 상/하 변(가로변)이면 수평 방향 (문/창문이 가로로 길어짐)
    const isVertical = (minDistance === distanceToLeft || minDistance === distanceToRight);
    
    console.log('Direction result:', isVertical ? '수직(세로)' : '수평(가로)');
    
    return isVertical;
  }, []);

  // 모드 이벤트 등록
  useEffect(() => {
    const canvas = canvasObj.current;
    if (!canvas) return;
    canvas.off(); // 모든 mouse 이벤트 해제
    
    // 공통 초기화 (브러시 모드가 아닌 경우)
    if (mode !== "carbonized" && mode !== "soot") {
      canvas.isDrawingMode = false;
      canvas.off('path:created');
    }

    // 벽 그리기
    if (mode === "wall") {
      canvas.selection = false;
      
      // 모든 기존 객체를 선택 불가능하게 만들기
      canvas.getObjects().forEach(obj => {
        obj.set({
          selectable: false,
          evented: false
        });
      });
      
      // 활성 선택된 객체 해제
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      
      let drawing = false;
      let start = null;
      let line = null;
      
      canvas.on("mouse:down", ({ e }) => {
        const mousePos = canvas.getPointer(e);
        
        // 스냅 포인트 확인
        const snapPos = findSnapPoint(mousePos);
        const startPos = snapPos || mousePos;
        
        drawing = true;
        start = startPos;
        
        line = new fabric.Line([startPos.x, startPos.y, startPos.x, startPos.y], {
          stroke: "#d32f2f",
          strokeWidth: 8,
          strokeLineCap: "round",
          selectable: false,
          evented: false,
          perPixelTargetFind: true,
          targetFindTolerance: 4,
        });
        canvas.add(line);
        
        if (snapPos) {
          setDebugInfo(`🔗 벽 연결점에 스냅됨! (${startPos.x.toFixed(0)}, ${startPos.y.toFixed(0)})`);
        }
      });
      
      canvas.on("mouse:move", ({ e }) => {
        const mousePos = canvas.getPointer(e);
        
        // 스냅 포인트만 확인 (시각적 표시 없음 - 문제 방지)
        const snapPos = findSnapPoint(mousePos);
        if (snapPos && !drawing) {
          // 스냅 가능할 때만 커서 변경이나 메시지로 표시
          canvas.defaultCursor = 'crosshair';
          setDebugInfo(`🎯 연결 가능한 지점 발견 (${snapPos.x.toFixed(0)}, ${snapPos.y.toFixed(0)})`);
        } else if (!drawing) {
          canvas.defaultCursor = 'crosshair';
          setDebugInfo('');
        }
        
        // 벽 그리기 중
        if (!drawing || !line) return;
        
        // 끝점도 스냅 확인 (그리기 중에는 끝점 스냅 적용)
        const endSnapPos = findSnapPoint(mousePos);
        const targetPos = endSnapPos || mousePos;
        
        let dx = targetPos.x - start.x;
        let dy = targetPos.y - start.y;
        
        // axisLock 적용 (스냅된 시작점 기준으로)
        if (axisLock) {
          if (Math.abs(dx) > Math.abs(dy)) dy = 0;
          else dx = 0;
        }
        
        // 최종 끝점 계산
        const finalEndX = start.x + dx;
        const finalEndY = start.y + dy;
        
        line.set({ x2: finalEndX, y2: finalEndY });
        
        // 보조선 표시 (마우스 위치 기준 수직/수평선)
        showGuidelines(finalEndX, finalEndY);
        
        canvas.requestRenderAll();
      });
      
      canvas.on("mouse:up", ({ e }) => {
        drawing = false;
        if (!line) return;
        
        // 보조선 제거
        canvas.getObjects().forEach(obj => {
          if (obj.isGuideline) {
            canvas.remove(obj);
          }
        });
        
        const mousePos = canvas.getPointer(e);
        
        // 끝점도 스냅 확인
        const endSnapPos = findSnapPoint(mousePos);
        const targetPos = endSnapPos || mousePos;
        
        // axisLock 적용해서 최종 끝점 계산
        let dx = targetPos.x - start.x;
        let dy = targetPos.y - start.y;
        
        if (axisLock) {
          if (Math.abs(dx) > Math.abs(dy)) dy = 0;
          else dx = 0;
        }
        
        const finalEndX = start.x + dx;
        const finalEndY = start.y + dy;
        const len = Math.hypot(finalEndX - start.x, finalEndY - start.y);
        
        if (len < 5) {
          canvas.remove(line);
        } else {
          const angle = (Math.atan2(finalEndY - start.y, finalEndX - start.x) * 180) / Math.PI;
          // 임시 line 제거
          canvas.remove(line);
          
          // 벽 생성 시 정확한 연결을 위한 위치 조정
          let wallLeft = start.x;
          let wallTop = start.y;
          
          // Rect 형태 벽 생성 (개선된 연결)
          const wall = new fabric.Rect({
            left: wallLeft,
            top: wallTop,
            originX: 'left',
            originY: 'center',
            width: len,
            height: 8,
            angle,
            fill: '#888',
            stroke: null, // 테두리 제거
            strokeWidth: 0,
            selectable: false, // 벽 그리기 모드에서는 선택 불가
            evented: false,
          });
          wall.setCoords();
          canvas.add(wall);
          
          // 디버깅: 벽 생성 시 각도 확인
          const { isHorizontal, isVertical } = getWallOrientation(angle);
          const connectMsg = endSnapPos ? " (끝점 연결됨)" : "";
          setDebugInfo(`✅ 벽 생성: ${len.toFixed(0)}px, ${angle.toFixed(1)}° (${isVertical ? '수직' : isHorizontal ? '수평' : '대각선'})${connectMsg}`);
        }
        canvas.requestRenderAll();
        line = null;
      });
    }
    // 방 그리기 (벽 4개로 구성) - 수정된 기능
    else if (mode === "room") {
      canvas.selection = false;
      
      // 모든 기존 객체를 선택 불가능하게 만들기
      canvas.getObjects().forEach(obj => {
        obj.set({
          selectable: false,
          evented: false
        });
      });
      
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      
      let drawing = false;
      let startPos = null;
      let tempWalls = []; // 임시 벽들을 저장할 배열
      
      canvas.on("mouse:down", ({ e }) => {
        const mousePos = canvas.getPointer(e);
        drawing = true;
        startPos = mousePos;
        setDebugInfo("🏠 방 그리기 시작 - 드래그하여 벽 4개로 구성된 방 생성");
      });
      
      canvas.on("mouse:move", ({ e }) => {
        if (!drawing) return;
        
        const mousePos = canvas.getPointer(e);
        
        // 기존 임시 벽들 제거
        tempWalls.forEach(wall => canvas.remove(wall));
        tempWalls = [];
        
        // 좌표 정리 (음수 크기 처리)
        const left = Math.min(startPos.x, mousePos.x);
        const right = Math.max(startPos.x, mousePos.x);
        const top = Math.min(startPos.y, mousePos.y);
        const bottom = Math.max(startPos.y, mousePos.y);
        
        const width = right - left;
        const height = bottom - top;
        
        // 최소 크기 체크
        if (width > 20 && height > 20) {
          // 상단 벽 (수평)
          const topWall = new fabric.Rect({
            left: left,
            top: top,
            originX: 'left',
            originY: 'center',
            width: width,
            height: 8,
            angle: 0,
            fill: '#888',
            stroke: null,
            strokeWidth: 0,
            selectable: false,
            evented: false,
            opacity: 0.7, // 임시 표시용 투명도
          });
          
          // 하단 벽 (수평)
          const bottomWall = new fabric.Rect({
            left: left,
            top: bottom,
            originX: 'left',
            originY: 'center',
            width: width,
            height: 8,
            angle: 0,
            fill: '#888',
            stroke: null,
            strokeWidth: 0,
            selectable: false,
            evented: false,
            opacity: 0.7,
          });
          
          // 좌측 벽 (수직)
          const leftWall = new fabric.Rect({
            left: left,
            top: top,
            originX: 'left',
            originY: 'center',
            width: height,
            height: 8,
            angle: 90,
            fill: '#888',
            stroke: null,
            strokeWidth: 0,
            selectable: false,
            evented: false,
            opacity: 0.7,
          });
          
          // 우측 벽 (수직)
          const rightWall = new fabric.Rect({
            left: right,
            top: top,
            originX: 'left',
            originY: 'center',
            width: height,
            height: 8,
            angle: 90,
            fill: '#888',
            stroke: null,
            strokeWidth: 0,
            selectable: false,
            evented: false,
            opacity: 0.7,
          });
          
          tempWalls = [topWall, bottomWall, leftWall, rightWall];
          tempWalls.forEach(wall => canvas.add(wall));
        }
        
        // 보조선 표시
        showGuidelines(mousePos.x, mousePos.y);
        
        canvas.renderAll();
      });
      
      canvas.on("mouse:up", () => {
        if (!drawing) return;
        
        drawing = false;
        
        // 보조선 제거
        canvas.getObjects().forEach(obj => {
          if (obj.isGuideline) {
            canvas.remove(obj);
          }
        });
        
        // 임시 벽들이 있으면 실제 벽으로 변환
        if (tempWalls.length === 4) {
          // 임시 벽들 제거
          tempWalls.forEach(wall => canvas.remove(wall));
          
          // 실제 벽들 생성
          tempWalls.forEach(tempWall => {
            const realWall = new fabric.Rect({
              left: tempWall.left,
              top: tempWall.top,
              originX: tempWall.originX,
              originY: tempWall.originY,
              width: tempWall.width,
              height: tempWall.height,
              angle: tempWall.angle,
              fill: '#888',
              stroke: null,
              strokeWidth: 0,
              selectable: true,
              evented: true,
              opacity: 1, // 완전 불투명
            });
            realWall.setCoords();
            canvas.add(realWall);
          });
          
          const roomWidth = Math.abs(tempWalls[0].width);
          const roomHeight = Math.abs(tempWalls[2].width);
          setDebugInfo(`✅ 방 생성 완료: ${roomWidth.toFixed(0)}×${roomHeight.toFixed(0)}px (벽 4개)`);
        } else {
          setDebugInfo("❌ 방이 너무 작습니다. 다시 그려주세요.");
        }
        
        canvas.renderAll();
        startPos = null;
        tempWalls = [];
      });
    }
    // 문 추가 (드래그로 길이 조정) - 개선된 벽 방향 판단
    else if (mode === "door") {
      canvas.selection = false;
      
      // 벽만 선택 가능하게, 문은 선택 불가능하게
      canvas.getObjects().forEach(obj => {
        if (obj.type === 'rect' && obj.height === 8) {
          // 벽 객체는 클릭 가능
          obj.set({
            selectable: false,
            evented: true
          });
        } else {
          // 문 등 다른 객체는 클릭 불가능
          obj.set({
            selectable: false,
            evented: false
          });
        }
      });
      
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      
      let drawing = false;
      let startPos = null;
      let wallTarget = null;
      let tempDoor = null;
      
      canvas.on("mouse:down", opt => {
        const { e, target } = opt;
        const { x, y } = canvas.getPointer(e);
        
        // 벽 클릭 시 - 드래그로 길이 조정
        if (target && target.type === "rect" && target.height === 8) {
          drawing = true;
          startPos = { x, y };
          wallTarget = target;
          
          // 벽의 각도로 방향 판단
          const wallAngle = target.angle || 0;
          const orientation = getWallOrientation(wallAngle);
          const isVertical = orientation.isVertical;
          
          console.log(`벽 클릭: 각도=${wallAngle}°, 수직=${isVertical}`);
          
          let doorAngle = 0;
          let initialWidth = isVertical ? 8 : 20;  // 수직벽이면 문폭 8, 수평벽이면 문폭 20
          let initialHeight = isVertical ? 20 : 8; // 수직벽이면 문높이 20, 수평벽이면 문높이 8
          
          tempDoor = new fabric.Rect({
            left: x,
            top: y,
            width: initialWidth,
            height: initialHeight,
            angle: doorAngle,
            fill: '#ffffff',
            stroke: '#000000',
            strokeWidth: 2,
            rx: 3,
            ry: 3,
            selectable: false,
            evented: false,
            originX: 'left',
            originY: 'top',
          });
          
          canvas.add(tempDoor);
          canvas.renderAll();
        }
        // 빈 공간 클릭 시 - 드래그로 길이 조정
        else if (!target) {
          drawing = true;
          startPos = { x, y };
          wallTarget = null;
          
          tempDoor = new fabric.Rect({
            left: x,
            top: y,
            width: 20,
            height: 12,
            angle: 0,
            fill: '#ffffff',
            stroke: '#000000',
            strokeWidth: 2,
            rx: 3,
            ry: 3,
            selectable: false,
            evented: false,
            originX: 'left',
            originY: 'top',
          });
          
          canvas.add(tempDoor);
          canvas.renderAll();
        }
      });
      
      canvas.on("mouse:move", ({ e }) => {
        if (!drawing || !tempDoor) return;
        
        const { x, y } = canvas.getPointer(e);
        
        if (wallTarget) {
          // 벽의 각도로 방향 판단
          const wallAngle = wallTarget.angle || 0;
          const orientation = getWallOrientation(wallAngle);
          const isVertical = orientation.isVertical;
          
          if (isVertical) {
            // 수직벽: 문이 세로로 길어짐 (폭은 고정)
            const height = Math.abs(y - startPos.y);
            const minHeight = 15;
            const maxHeight = 80;
            const finalHeight = Math.min(Math.max(height, minHeight), maxHeight);
            
            tempDoor.set({
              width: 8,
              height: finalHeight,
              top: Math.min(startPos.y, y)
            });
          } else {
            // 수평벽: 문이 가로로 길어짐 (높이는 고정)
            const width = Math.abs(x - startPos.x);
            const minWidth = 15;
            const maxWidth = 80;
            const finalWidth = Math.min(Math.max(width, minWidth), maxWidth);
            
            tempDoor.set({
              width: finalWidth,
              height: 8,
              left: Math.min(startPos.x, x)
            });
          }
        } else {
          // 빈 공간에서는 가로 길이 조정
          const width = Math.abs(x - startPos.x);
          const minWidth = 15;
          const maxWidth = 80;
          const finalWidth = Math.min(Math.max(width, minWidth), maxWidth);
          
          tempDoor.set({
            width: finalWidth,
            height: 12,
            left: Math.min(startPos.x, x)
          });
        }
        
        canvas.renderAll();
      });
      
      canvas.on("mouse:up", () => {
        if (!drawing || !tempDoor) return;
        
        drawing = false;
        tempDoor.set({
          selectable: true,
          evented: true
        });
        
        const finalWidth = tempDoor.width;
        const finalHeight = tempDoor.height;
        const wallInfo = wallTarget ? `(${wallTarget.angle || 0}° 벽)` : '(자유배치)';
        setDebugInfo(`문 생성됨: ${finalWidth.toFixed(0)}×${finalHeight.toFixed(0)} ${wallInfo}`);
        
        startPos = null;
        wallTarget = null;
        tempDoor = null;
      });
    }
    // 창문 추가 (드래그로 길이 조정) - 개선된 벽 방향 판단
    else if (mode === "window") {
      canvas.selection = false;
      
      canvas.getObjects().forEach(obj => {
        if (obj.type === 'rect' && obj.height === 8) {
          obj.set({ selectable: false, evented: true });
        } else {
          obj.set({ selectable: false, evented: false });
        }
      });
      
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      
      let drawing = false;
      let startPos = null;
      let wallTarget = null;
      let tempWindow = null;
      
      canvas.on("mouse:down", opt => {
        const { e, target } = opt;
        const { x, y } = canvas.getPointer(e);
        
        if (target && target.type === "rect" && target.height === 8) {
          drawing = true;
          startPos = { x, y };
          wallTarget = target;
          
          // 벽의 각도로 방향 판단
          const wallAngle = target.angle || 0;
          const orientation = getWallOrientation(wallAngle);
          const isVertical = orientation.isVertical;
          
          console.log(`창문 설치 - 벽 각도: ${wallAngle}°, 수직: ${isVertical}`);
          
          let windowAngle = 0;
          let initialWidth = isVertical ? 8 : 20;  // 수직벽이면 창문폭 8, 수평벽이면 창문폭 20
          let initialHeight = isVertical ? 20 : 8; // 수직벽이면 창문높이 20, 수평벽이면 창문높이 8
          
          tempWindow = new fabric.Rect({
            left: x,
            top: y,
            width: initialWidth,
            height: initialHeight,
            angle: windowAngle,
            fill: 'transparent',
            stroke: '#666666',
            strokeWidth: 2,
            strokeDashArray: [5, 5],
            rx: 2,
            ry: 2,
            selectable: false,
            evented: false,
            originX: 'left',
            originY: 'top',
          });
          
          canvas.add(tempWindow);
          canvas.renderAll();
        }
        else if (!target) {
          drawing = true;
          startPos = { x, y };
          wallTarget = null;
          
          tempWindow = new fabric.Rect({
            left: x,
            top: y,
            width: 20,
            height: 8,
            angle: 0,
            fill: 'transparent',
            stroke: '#666666',
            strokeWidth: 2,
            strokeDashArray: [5, 5],
            rx: 2,
            ry: 2,
            selectable: false,
            evented: false,
            originX: 'left',
            originY: 'top',
          });
          
          canvas.add(tempWindow);
          canvas.renderAll();
        }
      });
      
      canvas.on("mouse:move", ({ e }) => {
        if (!drawing || !tempWindow) return;
        
        const { x, y } = canvas.getPointer(e);
        
        if (wallTarget) {
          // 벽의 각도로 방향 판단
          const wallAngle = wallTarget.angle || 0;
          const orientation = getWallOrientation(wallAngle);
          const isVertical = orientation.isVertical;
          
          if (isVertical) {
            // 수직벽: 창문이 세로로 길어짐
            const height = Math.abs(y - startPos.y);
            const minHeight = 15;
            const maxHeight = 100;
            const finalHeight = Math.min(Math.max(height, minHeight), maxHeight);
            
            tempWindow.set({
              width: 8,
              height: finalHeight,
              top: Math.min(startPos.y, y)
            });
          } else {
            // 수평벽: 창문이 가로로 길어짐
            const width = Math.abs(x - startPos.x);
            const minWidth = 15;
            const maxWidth = 100;
            const finalWidth = Math.min(Math.max(width, minWidth), maxWidth);
            
            tempWindow.set({
              width: finalWidth,
              height: 8,
              left: Math.min(startPos.x, x)
            });
          }
        } else {
          // 빈 공간에서는 가로 길이 조정
          const width = Math.abs(x - startPos.x);
          const minWidth = 15;
          const maxWidth = 100;
          const finalWidth = Math.min(Math.max(width, minWidth), maxWidth);
          
          tempWindow.set({
            width: finalWidth,
            height: 8,
            left: Math.min(startPos.x, x)
          });
        }
        
        canvas.renderAll();
      });
      
      canvas.on("mouse:up", () => {
        if (!drawing || !tempWindow) return;
        
        drawing = false;
        tempWindow.set({
          selectable: true,
          evented: true
        });
        
        const finalWidth = tempWindow.width;
        const finalHeight = tempWindow.height;
        const wallInfo = wallTarget ? `(${wallTarget.angle || 0}° 벽)` : '(자유배치)';
        setDebugInfo(`창문 생성됨: ${finalWidth.toFixed(0)}×${finalHeight.toFixed(0)} ${wallInfo}`);
        
        startPos = null;
        wallTarget = null;
        tempWindow = null;
      });
    }
    // 벽면콘센트 추가
    else if (mode === "outlet") {
      canvas.selection = false;
      canvas.getObjects().forEach(obj => obj.set({ selectable: false, evented: false }));
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      
      canvas.on("mouse:down", ({ e }) => {
        const { x, y } = canvas.getPointer(e);
        const outlet = new fabric.Rect({
          left: x,
          top: y,
          width: 16,
          height: 10,
          fill: '#4CAF50',
          stroke: '#000000',
          strokeWidth: 2,
          rx: 2,
          ry: 2,
          originX: 'center',
          originY: 'center',
          selectable: true,
          evented: true,
        });
        canvas.add(outlet);
        canvas.renderAll();
        setDebugInfo("벽면콘센트 추가됨 (초록색)");
      });
    }
    // 멀티탭 추가
    else if (mode === "multitap") {
      canvas.selection = false;
      canvas.getObjects().forEach(obj => obj.set({ selectable: false, evented: false }));
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      
      canvas.on("mouse:down", ({ e }) => {
        const { x, y } = canvas.getPointer(e);
        const multitap = new fabric.Rect({
          left: x,
          top: y,
          width: 20,
          height: 8,
          fill: '#9C27B0',
          stroke: '#000000',
          strokeWidth: 2,
          rx: 2,
          ry: 2,
          originX: 'center',
          originY: 'center',
          selectable: true,
          evented: true,
        });
        canvas.add(multitap);
        canvas.renderAll();
        setDebugInfo("멀티탭 추가됨 (보라색, 문보다 작게)");
      });
    }
    // 차단기함 추가
    else if (mode === "breaker") {
      canvas.selection = false;
      canvas.getObjects().forEach(obj => obj.set({ selectable: false, evented: false }));
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      
      canvas.on("mouse:down", ({ e }) => {
        const { x, y } = canvas.getPointer(e);
        const breaker = new fabric.Rect({
          left: x,
          top: y,
          width: 24,
          height: 24,
          fill: '#000000',
          stroke: '#333333',
          strokeWidth: 2,
          rx: 2,
          ry: 2,
          originX: 'center',
          originY: 'center',
          selectable: true,
          evented: true,
        });
        canvas.add(breaker);
        canvas.renderAll();
        setDebugInfo("차단기함 추가됨 (검은색)");
      });
    }
    // 용융흔 추가 (X자 모양)
    else if (mode === "burn") {
      canvas.selection = false;
      canvas.getObjects().forEach(obj => obj.set({ selectable: false, evented: false }));
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      
      canvas.on("mouse:down", ({ e }) => {
        const { x, y } = canvas.getPointer(e);
        
        const line1 = new fabric.Line([x-8, y-8, x+8, y+8], {
          stroke: '#ff0000',
          strokeWidth: 3,
          originX: 'center',
          originY: 'center',
          selectable: false,
          evented: false,
        });
        const line2 = new fabric.Line([x-8, y+8, x+8, y-8], {
          stroke: '#ff0000',
          strokeWidth: 3,
          originX: 'center',
          originY: 'center',
          selectable: false,
          evented: false,
        });
        
        const burnMark = new fabric.Group([line1, line2], {
          left: x,
          top: y,
          originX: 'center',
          originY: 'center',
          selectable: true,
          evented: true,
        });
        
        canvas.add(burnMark);
        canvas.renderAll();
        setDebugInfo("용융흔 추가됨");
      });
    }
    // 자유선 그리기 (전선)
    else if (mode === "wire") {
      canvas.selection = false;
      canvas.getObjects().forEach(obj => obj.set({ selectable: false, evented: false }));
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      
      let wireDrawing = false;
      let wirePoints = [];
      let wireCurrentPath = null;
      
      canvas.on("mouse:down", ({ e }) => {
        wireDrawing = true;
        const pointer = canvas.getPointer(e);
        wirePoints = [`M ${pointer.x} ${pointer.y}`];
        
        wireCurrentPath = new fabric.Path(wirePoints.join(' '), {
          stroke: '#0066cc',
          strokeWidth: 3,
          fill: '',
          selectable: false,
          evented: false,
          wireElement: true,
          visible: showWires,
        });
        canvas.add(wireCurrentPath);
      });
      
      canvas.on("mouse:move", ({ e }) => {
        if (!wireDrawing || !wireCurrentPath) return;
        const pointer = canvas.getPointer(e);
        
        wirePoints.push(`L ${pointer.x} ${pointer.y}`);
        const pathString = wirePoints.join(' ');
        
        canvas.remove(wireCurrentPath);
        wireCurrentPath = new fabric.Path(pathString, {
          stroke: '#0066cc',
          strokeWidth: 3,
          fill: '',
          selectable: false,
          evented: false,
          wireElement: true,
          visible: showWires,
        });
        canvas.add(wireCurrentPath);
        canvas.renderAll();
      });
      
      canvas.on("mouse:up", () => {
        wireDrawing = false;
        if (wireCurrentPath) {
          wireCurrentPath.set({ selectable: true, evented: true });
          canvas.renderAll();
          setDebugInfo("전선 추가됨 (자유선)");
        }
        wirePoints = [];
        wireCurrentPath = null;
      });
    }
    // 탄화면적 그리기 (페인트 브러시 방식)
    else if (mode === "carbonized") {
      canvas.selection = false;
      canvas.getObjects().forEach(obj => obj.set({ selectable: false, evented: false }));
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      
      canvas.off('path:created');
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush.width = 20;
      canvas.freeDrawingBrush.color = 'rgba(204, 0, 0, 0.7)'; // 더 빨간색, 투명도 증가
      
      canvas.on('path:created', (e) => {
        const path = e.path;
        path.set({
          carbonizedArea: true,
          visible: showCarbonized,
          selectable: true,
          evented: true,
        });
        setDebugInfo("탄화면적 추가됨 (브러시 방식 - 더 빨간색)");
        canvas.renderAll();
      });
    }
    // 그을음피해 그리기 (페인트 브러시 방식)
    else if (mode === "soot") {
      canvas.selection = false;
      canvas.getObjects().forEach(obj => obj.set({ selectable: false, evented: false }));
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      
      canvas.off('path:created');
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush.width = 25;
      canvas.freeDrawingBrush.color = 'rgba(255, 99, 99, 0.3)';
      
      canvas.on('path:created', (e) => {
        const path = e.path;
        path.set({
          sootArea: true,
          visible: showSoot,
          selectable: true,
          evented: true,
        });
        setDebugInfo("그을음피해 추가됨 (브러시 방식)");
        canvas.renderAll();
      });
    }
    // 증거물 추가
    else if (mode === "evidence") {
      canvas.selection = false;
      canvas.getObjects().forEach(obj => obj.set({ selectable: false, evented: false }));
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      
      canvas.on("mouse:down", ({ e }) => {
        const { x, y } = canvas.getPointer(e);
        const evidence = new fabric.Rect({
          left: x,
          top: y,
          width: 16,
          height: 10,
          fill: '#FFEB3B', // 노란색
          stroke: '#F57F17', // 진한 노란색 테두리
          strokeWidth: 2,
          rx: 2,
          ry: 2,
          originX: 'center',
          originY: 'center',
          selectable: true,
          evented: true,
        });
        canvas.add(evidence);
        canvas.renderAll();
        setDebugInfo("증거물 추가됨 (노란색)");
      });
    }
    // 선택 모드
    else {
      canvas.selection = true;
      canvas.isDrawingMode = false;
      canvas.off('path:created');
      
      canvas.getObjects().forEach(obj => {
        obj.set({
          selectable: true,
          evented: true
        });
      });
      canvas.requestRenderAll();
      
      canvas.on("mouse:down", ({ target, e }) => {
        const pointer = canvas.getPointer(e);
        
        // 더 정확한 겹친 객체 찾기
        const objectsAtPoint = [];
        
        // 모든 객체를 역순으로 확인 (위에 있는 객체부터)
        const allObjects = canvas.getObjects().slice().reverse();
        allObjects.forEach(obj => {
          if (obj.containsPoint && obj.containsPoint(pointer)) {
            objectsAtPoint.push(obj);
          }
        });
        
        // 가이드라인은 제외
        const validObjects = objectsAtPoint.filter(obj => !obj.isGuideline);
        
        if (validObjects.length > 0) {
          const currentActive = canvas.getActiveObject();
          let targetObject = validObjects[0];
          
          // 여러 객체가 겹쳐있고 현재 선택된 객체가 있는 경우
          if (validObjects.length > 1 && currentActive) {
            const currentIndex = validObjects.indexOf(currentActive);
            if (currentIndex !== -1 && currentIndex < validObjects.length - 1) {
              targetObject = validObjects[currentIndex + 1];
            } else if (currentIndex !== -1) {
              targetObject = validObjects[0];
            }
          }
          
          canvas.setActiveObject(targetObject);
          canvas.renderAll();
          setDebugInfo(`선택됨: ${targetObject.type || '객체'} (${validObjects.length}개 겹침)`);
        } else if (target) {
          canvas.setActiveObject(target);
          setDebugInfo(`선택됨: ${target.type || '객체'}`);
        }
      });
    }
  }, [mode, axisLock, showWires, showCarbonized, showSoot, findSnapPoint, getWallOrientation, getRoomSideDirection, showGuidelines]);

  // 현재 모드에 따른 설명 텍스트
  const getModeDescription = () => {
    switch(mode) {
      case 'wall': return '🟥 벽 그리기 모드: 클릭 후 드래그하여 벽을 그리세요';
      case 'room': return '🏠 방 그리기 모드: 드래그하여 벽 4개로 구성된 방을 만드세요';
      case 'door': return '🚪 문 추가 모드: 벽이나 방을 클릭 후 드래그하여 문을 만드세요';
      case 'window': return '🪟 창문 추가 모드: 벽이나 방을 클릭 후 드래그하여 창문을 만드세요';
      case 'outlet': return '🔌 콘센트 모드: 클릭하여 벽면콘센트를 추가하세요';
      case 'multitap': return '🔌 멀티탭 모드: 클릭하여 멀티탭을 추가하세요';
      case 'breaker': return '⚡ 차단기함 모드: 클릭하여 차단기함을 추가하세요';
      case 'wire': return '⚡ 전선 모드: 드래그하여 자유선 전선을 그리세요';
      case 'burn': return '❌ 용융흔 모드: 클릭하여 X자 모양 용융흔을 추가하세요';
      case 'carbonized': return '🔥 탄화면적 모드: 브러시로 탄화면적을 칠하세요';
      case 'soot': return '💨 그을음피해 모드: 브러시로 그을음피해를 칠하세요';
      case 'evidence': return '📋 증거물 모드: 클릭하여 증거물을 추가하세요';
      default: return '↔️ 선택 모드: 객체를 선택하고 이동/크기 조절하세요';
    }
  };

  // 전선/피해면적 표시/숨김 기능
  useEffect(() => {
    const canvas = canvasObj.current;
    if (!canvas) return;
    
    canvas.getObjects().forEach(obj => {
      if (obj.wireElement) {
        obj.set('visible', showWires);
      }
      if (obj.carbonizedArea) {
        obj.set('visible', showCarbonized);
      }
      if (obj.sootArea) {
        obj.set('visible', showSoot);
      }
    });
    canvas.renderAll();
  }, [showWires, showCarbonized, showSoot]);

  // 삭제 함수
  const deleteSelected = () => {
    const canvas = canvasObj.current;
    if (!canvas) return;
    
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
      if (activeObject.type === "activeSelection") {
        activeObject.forEachObject(o => canvas.remove(o));
      } else {
        canvas.remove(activeObject);
      }
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      setDebugInfo("선택된 객체 삭제됨");
    } else {
      setDebugInfo("삭제할 객체를 선택해주세요");
    }
  };

  // 저장 함수 (범례 포함)
  const saveProject = () => {
    const canvas = canvasObj.current;
    if (!canvas) return;
    
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    // 임시 캔버스 생성 (원본 + 범례)
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = Math.max(canvasWidth, 800); // 범례를 위한 최소 너비
    tempCanvas.height = canvasHeight + 150; // 범례 공간 추가
    
    // 원본 캔버스 내용 복사
    const originalData = canvas.toDataURL();
    const img = new Image();
    
    img.onload = () => {
      // 원본 캔버스 그리기
      tempCtx.drawImage(img, 0, 0);
      
      // 범례 배경
      tempCtx.fillStyle = '#ffffff';
      tempCtx.fillRect(0, canvasHeight, tempCanvas.width, 150);
      tempCtx.strokeStyle = '#333333';
      tempCtx.lineWidth = 2;
      tempCtx.strokeRect(0, canvasHeight, tempCanvas.width, 150);
      
      // 범례 제목
      tempCtx.fillStyle = '#000000';
      tempCtx.font = 'bold 16px Arial';
      tempCtx.fillText('범례 (Legend)', 20, canvasHeight + 25);
      
      // 범례 항목들 (벽 위주로 수정)
      const legendItems = [
        { color: '#888888', text: '벽', x: 20, y: canvasHeight + 45 },
        { color: '#ffffff', text: '문', x: 120, y: canvasHeight + 45, hasStroke: true },
        { color: 'transparent', text: '창문 (점선)', x: 220, y: canvasHeight + 45, isWindow: true },
        { color: '#4CAF50', text: '벽면콘센트', x: 350, y: canvasHeight + 45 },
        { color: '#9C27B0', text: '멀티탭', x: 480, y: canvasHeight + 45 },
        { color: '#000000', text: '차단기함', x: 580, y: canvasHeight + 45 },
        { color: '#0066cc', text: '전선', x: 20, y: canvasHeight + 75 },
        { color: '#ff0000', text: '용융흔 (X)', x: 120, y: canvasHeight + 75 },
        { color: 'rgba(204, 0, 0, 0.7)', text: '탄화면적', x: 220, y: canvasHeight + 75 },
        { color: 'rgba(255, 99, 99, 0.3)', text: '그을음피해', x: 340, y: canvasHeight + 75 },
        { color: '#FFEB3B', text: '증거물', x: 460, y: canvasHeight + 75 },
      ];
      
      legendItems.forEach(item => {
        // 색상 박스 그리기
        if (item.isWindow) {
          // 창문은 점선으로
          tempCtx.strokeStyle = '#666666';
          tempCtx.setLineDash([3, 3]);
          tempCtx.strokeRect(item.x, item.y - 10, 15, 10);
          tempCtx.setLineDash([]);
        } else {
          tempCtx.fillStyle = item.color;
          tempCtx.fillRect(item.x, item.y - 10, 15, 10);
          if (item.hasStroke) {
            tempCtx.strokeStyle = item.strokeColor || '#000000';
            tempCtx.strokeRect(item.x, item.y - 10, 15, 10);
          }
        }
        
        // 텍스트
        tempCtx.fillStyle = '#000000';
        tempCtx.font = '12px Arial';
        tempCtx.fillText(item.text, item.x + 20, item.y);
      });
      
      // 저장 정보
      tempCtx.font = '10px Arial';
      tempCtx.fillStyle = '#666666';
      const date = new Date().toLocaleString('ko-KR');
      tempCtx.fillText(`생성일시: ${date}`, 20, canvasHeight + 130);
      tempCtx.fillText(`화재조사 평면도 - 캔버스 크기: ${canvasWidth}×${canvasHeight}`, 20, canvasHeight + 110);
      
      // 다운로드
      const dataURL = tempCanvas.toDataURL('png', 1);
      const link = document.createElement('a');
      link.download = `화재조사_평면도_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setDebugInfo("평면도가 범례와 함께 저장되었습니다");
    };
    
    img.src = originalData;
  };

  return (
    <div style={{ 
      textAlign: 'center', 
      padding: isMobile ? 8 : 16,
      maxWidth: '100vw',
      overflow: 'hidden'
    }}>
      {/* 🔥 새로 추가된 제목 */}
      <div style={{
        backgroundColor: '#d32f2f',
        color: 'white',
        padding: isMobile ? '12px 8px' : '16px 16px',
        marginBottom: isMobile ? 12 : 16,
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
      }}>
        <h1 style={{
          margin: 0,
          fontSize: isMobile ? '18px' : '24px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}>
          🚒 인천소방 화재조사 평면도 그리기
        </h1>
        <p style={{
          margin: '4px 0 0 0',
          fontSize: isMobile ? '12px' : '14px',
          opacity: 0.9
        }}>
          화재 현장 평면도 작성 도구
        </p>
      </div>

      <div style={{ marginBottom: isMobile ? 8 : 12 }}>
        {/* 첫 번째 줄: 기본 도구들 (방 그리기 버튼 추가) */}
        <div style={{ marginBottom: isMobile ? 4 : 8, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px' }}>
          <button onClick={() => setMode('wall')} style={{ padding: isMobile ? '4px 8px' : '6px 10px', background: mode === 'wall' ? '#ffad33' : '#ddd', fontSize: isMobile ? '10px' : '12px', minWidth: isMobile ? '60px' : 'auto' }}>🟥 벽</button>
          <button onClick={() => setMode('room')} style={{ padding: isMobile ? '4px 8px' : '6px 10px', background: mode === 'room' ? '#3498db' : '#ddd', fontSize: isMobile ? '10px' : '12px', minWidth: isMobile ? '60px' : 'auto', color: mode === 'room' ? 'white' : 'black' }}>🏠 방</button>
          <button onClick={() => setMode('door')} style={{ padding: isMobile ? '4px 8px' : '6px 10px', background: mode === 'door' ? '#4CAF50' : '#ddd', fontSize: isMobile ? '10px' : '12px', minWidth: isMobile ? '60px' : 'auto' }}>🚪 문</button>
          <button onClick={() => setMode('window')} style={{ padding: isMobile ? '4px 8px' : '6px 10px', background: mode === 'window' ? '#2196F3' : '#ddd', fontSize: isMobile ? '10px' : '12px', minWidth: isMobile ? '60px' : 'auto' }}>🪟 창문</button>
          <button onClick={() => setMode('')} style={{ padding: isMobile ? '4px 8px' : '6px 10px', background: mode === '' ? '#bbb' : '#eee', fontSize: isMobile ? '10px' : '12px', minWidth: isMobile ? '60px' : 'auto' }}>↔️ 선택</button>
          <button onClick={deleteSelected} style={{ padding: isMobile ? '4px 8px' : '6px 10px', background: '#ff4444', color: 'white', fontSize: isMobile ? '10px' : '12px', minWidth: isMobile ? '60px' : 'auto' }}>🗑️ 삭제</button>
        </div>
        
        {/* 두 번째 줄: 전기 관련 도구들 */}
        <div style={{ marginBottom: isMobile ? 4 : 8, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px' }}>
          <button onClick={() => setMode('outlet')} style={{ padding: isMobile ? '4px 8px' : '6px 10px', background: mode === 'outlet' ? '#2196F3' : '#ddd', fontSize: isMobile ? '10px' : '12px', minWidth: isMobile ? '70px' : 'auto' }}>🔌 콘센트</button>
          <button onClick={() => setMode('multitap')} style={{ padding: isMobile ? '4px 8px' : '6px 10px', background: mode === 'multitap' ? '#9C27B0' : '#ddd', fontSize: isMobile ? '10px' : '12px', minWidth: isMobile ? '70px' : 'auto' }}>🔌 멀티탭</button>
          <button onClick={() => setMode('breaker')} style={{ padding: isMobile ? '4px 8px' : '6px 10px', background: mode === 'breaker' ? '#333333' : '#ddd', color: mode === 'breaker' ? 'white' : 'black', fontSize: isMobile ? '10px' : '12px', minWidth: isMobile ? '70px' : 'auto' }}>⚡ 차단기함</button>
          <button onClick={() => setMode('wire')} style={{ padding: isMobile ? '4px 8px' : '6px 10px', background: mode === 'wire' ? '#607D8B' : '#ddd', fontSize: isMobile ? '10px' : '12px', minWidth: isMobile ? '60px' : 'auto' }}>⚡ 전선</button>
        </div>
        
        {/* 세 번째 줄: 화재 관련 */}
        <div style={{ marginBottom: isMobile ? 4 : 8, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px' }}>
          <button onClick={() => setMode('burn')} style={{ padding: isMobile ? '4px 8px' : '6px 10px', background: mode === 'burn' ? '#FF5722' : '#ddd', fontSize: isMobile ? '10px' : '12px', minWidth: isMobile ? '60px' : 'auto' }}>❌ 용융흔</button>
          <button onClick={() => setMode('carbonized')} style={{ padding: isMobile ? '4px 8px' : '6px 10px', background: mode === 'carbonized' ? '#8B0000' : '#ddd', color: mode === 'carbonized' ? 'white' : 'black', fontSize: isMobile ? '10px' : '12px', minWidth: isMobile ? '70px' : 'auto' }}>🔥 탄화면적</button>
          <button onClick={() => setMode('soot')} style={{ padding: isMobile ? '4px 8px' : '6px 10px', background: mode === 'soot' ? '#FF6363' : '#ddd', fontSize: isMobile ? '10px' : '12px', minWidth: isMobile ? '70px' : 'auto' }}>💨 그을음피해</button>
          <button onClick={() => setMode('evidence')} style={{ padding: isMobile ? '4px 8px' : '6px 10px', background: mode === 'evidence' ? '#FFEB3B' : '#ddd', fontSize: isMobile ? '10px' : '12px', minWidth: isMobile ? '60px' : 'auto' }}>📋 증거물</button>
        </div>
        
        {/* 네 번째 줄: 옵션 및 저장 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: isMobile ? '8px' : '10px' }}>
          <label style={{ fontSize: isMobile ? '10px' : '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input type='checkbox' checked={axisLock} onChange={() => setAxisLock(v => !v)} style={{ transform: isMobile ? 'scale(0.8)' : 'scale(1)' }} /> 수직·수평만
          </label>
          <label style={{ fontSize: isMobile ? '10px' : '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input type='checkbox' checked={showWires} onChange={() => setShowWires(v => !v)} style={{ transform: isMobile ? 'scale(0.8)' : 'scale(1)' }} /> 전선표시
          </label>
          <label style={{ fontSize: isMobile ? '10px' : '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input type='checkbox' checked={showCarbonized} onChange={() => setShowCarbonized(v => !v)} style={{ transform: isMobile ? 'scale(0.8)' : 'scale(1)' }} /> 탄화면적
          </label>
          <label style={{ fontSize: isMobile ? '10px' : '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input type='checkbox' checked={showSoot} onChange={() => setShowSoot(v => !v)} style={{ transform: isMobile ? 'scale(0.8)' : 'scale(1)' }} /> 그을음피해
          </label>
          <button onClick={saveProject} style={{ padding: isMobile ? '4px 8px' : '6px 10px', background: '#4CAF50', color: 'white', fontSize: isMobile ? '10px' : '11px' }}>💾 저장</button>
        </div>
      </div>
      
      {/* 🔥 새로 추가: 현재 모드 표시창 */}
      <div style={{
        backgroundColor: mode ? '#e3f2fd' : '#f5f5f5',
        border: `2px solid ${mode ? '#2196f3' : '#ccc'}`,
        borderRadius: '8px',
        padding: isMobile ? '8px 12px' : '12px 16px',
        marginBottom: isMobile ? 8 : 12,
        fontSize: isMobile ? '12px' : '14px',
        fontWeight: 'bold',
        color: mode ? '#1976d2' : '#666',
        textAlign: 'center',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        maxWidth: isMobile ? '100%' : '600px',
        margin: `0 auto ${isMobile ? 8 : 12}px auto`
      }}>
        {getModeDescription()}
      </div>

      <div style={{ overflow: 'auto', maxWidth: '100%' }}>
        <canvas 
          ref={canvasRef} 
          width={isMobile ? Math.min(window.innerWidth - 32, 400) : 800} 
          height={isMobile ? Math.min(window.innerHeight - 300, 300) : 600} 
          style={{ 
            border: '2px solid #333', 
            touchAction: 'none',
            maxWidth: '100%',
            height: 'auto'
          }} 
        />
      </div>
      <div style={{ marginTop: 8, fontSize: isMobile ? '8px' : '10px', color: '#666', lineHeight: '1.4', padding: '0 8px' }}>
        💡 **방 그리기**: 🏠 방 버튼 클릭 후 드래그하여 벽 4개로 구성된 방 생성 | **문/창문**: 벽을 클릭 후 드래그하여 생성<br/>
        🔧 **스마트 방향**: 수직벽(90°)에는 세로 문/창문, 수평벽(0°)에는 가로 문/창문 자동 적용 | 📏 **보조선**: 드래그 중 수직/수평선 표시<br/>
        🔥 **피해면적**: 페인트 브러시로 자유롭게 칠하기 | 각 레이어별 체크박스로 표시/숨김 가능
      </div>
      {debugInfo && (
        <div style={{ 
          marginTop: 8, 
          padding: isMobile ? '6px 8px' : '8px 12px', 
          backgroundColor: '#fff3cd', 
          border: '1px solid #ffeaa7',
          borderRadius: '4px',
          fontSize: isMobile ? '12px' : '14px',
          maxWidth: isMobile ? '100%' : '600px',
          margin: '8px auto'
        }}>
          🔍 {debugInfo}
        </div>
      )}
    </div>
  );
}