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
  const [showFurnitureMenu, setShowFurnitureMenu] = useState(false);
  const [selectedFurniture, setSelectedFurniture] = useState(null);

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

    // 가구 추가 모드
    if (mode === "furniture" && selectedFurniture) {
      canvas.selection = false;
      canvas.getObjects().forEach(obj => obj.set({ selectable: false, evented: false }));
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      
      let drawing = false;
      let startPos = null;
      let tempFurniture = null;
      
      const furnitureStyles = {
        '소파': { color: '#8B4513', label: '소파' },
        '냉장고': { color: '#C0C0C0', label: '냉장고' },
        'TV': { color: '#000000', label: 'TV' },
        '침대': { color: '#D2691E', label: '침대' },
        '테이블': { color: '#A0522D', label: '테이블' },
        '세탁기': { color: '#B0B0B0', label: '세탁기' }
      };
      
      const style = furnitureStyles[selectedFurniture];
      
      canvas.on("mouse:down", ({ e }) => {
        const { x, y } = canvas.getPointer(e);
        drawing = true;
        startPos = { x, y };
        
        tempFurniture = new fabric.Rect({
          left: x,
          top: y,
          width: 40,
          height: 40,
          fill: style.color,
          stroke: '#333333',
          strokeWidth: 2,
          rx: 3,
          ry: 3,
          selectable: false,
          evented: false,
          originX: 'left',
          originY: 'top',
          furnitureType: selectedFurniture,
        });
        
        canvas.add(tempFurniture);
        canvas.renderAll();
      });
      
      canvas.on("mouse:move", ({ e }) => {
        if (!drawing || !tempFurniture) return;
        
        const { x, y } = canvas.getPointer(e);
        const width = Math.abs(x - startPos.x);
        const height = Math.abs(y - startPos.y);
        
        const minSize = 20;
        const maxSize = 200;
        
        const finalWidth = Math.min(Math.max(width, minSize), maxSize);
        const finalHeight = Math.min(Math.max(height, minSize), maxSize);
        
        tempFurniture.set({
          left: Math.min(startPos.x, x),
          top: Math.min(startPos.y, y),
          width: finalWidth,
          height: finalHeight
        });
        
        canvas.renderAll();
      });
      
      canvas.on("mouse:up", () => {
        if (!drawing || !tempFurniture) return;
        
        drawing = false;
        
        const text = new fabric.Text(style.label, {
          left: tempFurniture.left + tempFurniture.width / 2,
          top: tempFurniture.top + tempFurniture.height / 2,
          fontSize: Math.max(12, Math.min(tempFurniture.width, tempFurniture.height) / 3),
          fill: '#FFFFFF',
          originX: 'center',
          originY: 'center',
          selectable: false,
          evented: false,
        });
        
        const furnitureGroup = new fabric.Group([tempFurniture, text], {
          left: tempFurniture.left,
          top: tempFurniture.top,
          selectable: true,
          evented: true,
          furnitureType: selectedFurniture,
        });
        
        canvas.remove(tempFurniture);
        canvas.add(furnitureGroup);
        canvas.renderAll();
        
        setDebugInfo(`${selectedFurniture} 추가됨 (${tempFurniture.width.toFixed(0)}×${tempFurniture.height.toFixed(0)})`);
        
        startPos = null;
        tempFurniture = null;
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
    // 문 추가 (벽에서만 생성) - 개선된 벽 방향 판단
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
        
        // 벽 클릭 시에만 문 생성
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
        } else {
          // 벽이 아닌 곳 클릭 시 안내 메시지
          setDebugInfo("⚠️ 벽을 클릭해야 문을 생성할 수 있습니다!");
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
    // 창문 추가 (벽에서만 생성) - 개선된 벽 방향 판단
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
        
        // 벽 클릭 시에만 창문 생성
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
        } else {
          // 벽이 아닌 곳 클릭 시 안내 메시지
          setDebugInfo("⚠️ 벽을 클릭해야 창문을 생성할 수 있습니다!");
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
    // 용융흔 추가 (X자 모양 + 검은 테두리)
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
        
        // 검은 테두리를 위한 더 굵은 선들
        const borderLine1 = new fabric.Line([x-8, y-8, x+8, y+8], {
          stroke: '#000000',
          strokeWidth: 5,
          originX: 'center',
          originY: 'center',
          selectable: false,
          evented: false,
        });
        const borderLine2 = new fabric.Line([x-8, y+8, x+8, y-8], {
          stroke: '#000000',
          strokeWidth: 5,
          originX: 'center',
          originY: 'center',
          selectable: false,
          evented: false,
        });
        
        const burnMark = new fabric.Group([borderLine1, borderLine2, line1, line2], {
          left: x,
          top: y,
          originX: 'center',
          originY: 'center',
          selectable: true,
          evented: true,
        });
        
        canvas.add(burnMark);
        canvas.renderAll();
        setDebugInfo("용융흔 추가됨 (검은 테두리)");
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
      canvas.freeDrawingBrush.color = 'rgba(204, 0, 0, 0.4)'; // 더 빨간색, 투명도 증가
      
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
    
    else if (mode === "") {
      canvas.selection = true;
      canvas.isDrawingMode = false;
      canvas.off('path:created');
      
      canvas.getObjects().forEach(obj => {
        obj.set({
          selectable: true,
          evented: true,
          lockScalingX: true,
          lockScalingY: true,
          lockRotation: true,
        });
      });
      canvas.requestRenderAll();
    }

    // 선택 모드 (개선된 객체 선택 로직)
    else {
      canvas.selection = true;
      canvas.isDrawingMode = false;
      canvas.off('path:created');
      
      canvas.getObjects().forEach(obj => {
        obj.set({
          selectable: true,
          evented: true,
          // 크기 조절 및 회전 잠금
          lockScalingX: true,
          lockScalingY: true,
          lockRotation: true,
        });
      });
      canvas.requestRenderAll();
      
      canvas.on("mouse:down", ({ target, e }) => {
        const pointer = canvas.getPointer(e);
        
        // 개선된 겹친 객체 찾기 로직
        const objectsAtPoint = [];
        
        // 모든 객체를 역순으로 확인 (위에 있는 객체부터)
        const allObjects = canvas.getObjects().slice().reverse();
        allObjects.forEach(obj => {
          if (obj.containsPoint && obj.containsPoint(pointer)) {
            objectsAtPoint.push(obj);
          }
        });
        
        // 가이드라인은 제외
        let validObjects = objectsAtPoint.filter(obj => !obj.isGuideline);
        
        // 탄화면적/그을음면적과 다른 객체가 겹쳐있는 경우 우선순위 조정
        if (validObjects.length > 1) {
          // 작은 객체 우선, path 객체(탄화면적/그을음면적) 후순위
          validObjects.sort((a, b) => {
            // path 객체는 우선순위 낮음
            if (a.type === 'path' && b.type !== 'path') return 1;
            if (b.type === 'path' && a.type !== 'path') return -1;
            
            // 크기가 작은 객체 우선
            const aSize = (a.width || 0) * (a.height || 0);
            const bSize = (b.width || 0) * (b.height || 0);
            return aSize - bSize;
          });
        }
        
        if (validObjects.length > 0) {
          const currentActive = canvas.getActiveObject();
          let targetObject = validObjects[0];
          
          // 여러 객체가 겹쳐있고 현재 선택된 객체가 있는 경우 순환 선택
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
          
          // 객체 타입 정보 더 자세히 표시
          let objectType = '객체';
          if (targetObject.type === 'rect' && targetObject.height === 8) objectType = '벽';
          else if (targetObject.type === 'rect' && targetObject.fill === '#ffffff') objectType = '문';
          else if (targetObject.type === 'rect' && targetObject.strokeDashArray) objectType = '창문';
          else if (targetObject.type === 'rect' && targetObject.fill === '#4CAF50') objectType = '콘센트';
          else if (targetObject.type === 'rect' && targetObject.fill === '#9C27B0') objectType = '멀티탭';
          else if (targetObject.type === 'rect' && targetObject.fill === '#000000') objectType = '차단기함';
          else if (targetObject.type === 'rect' && targetObject.fill === '#FFEB3B') objectType = '증거물';
          else if (targetObject.wireElement) objectType = '전선';
          else if (targetObject.carbonizedArea) objectType = '탄화면적';
          else if (targetObject.sootArea) objectType = '그을음면적';
          else if (targetObject.type === 'group') objectType = '용융흔';
          
          setDebugInfo(`선택됨: ${objectType} (${validObjects.length}개 겹침)`);
        } else if (target) {
          canvas.setActiveObject(target);
          setDebugInfo(`선택됨: ${target.type || '객체'}`);
        }
      });
    }

        
  }, [mode, axisLock, showWires, showCarbonized, showSoot, findSnapPoint, getWallOrientation, getRoomSideDirection, showGuidelines, selectedFurniture]);

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
      case 'deleteSelected': return '🗑️ 삭제 모드: 선택된 객체를 삭제하세요';
      case 'furniture': 
        return selectedFurniture 
          ? `🪑 ${selectedFurniture} 배치 모드: 드래그하여 크기를 조절하며 배치하세요`
          : '🪑 가구 모드: 배치할 가구를 선택하세요';
      default: 
        return '↔️ 선택 모드: 객체를 선택하고 이동하세요 (범례 클릭으로 타입별 순환 선택)';
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

  // 선택된 객체 미세 이동 함수들
  const moveSelectedObject = (direction) => {
    const canvas = canvasObj.current;
    if (!canvas) return;
    
    const activeObject = canvas.getActiveObject();
    if (!activeObject) {
      setDebugInfo("이동할 객체를 먼저 선택해주세요");
      return;
    }
    
    const moveDistance = 1; // 1픽셀씩 이동
    let newLeft = activeObject.left;
    let newTop = activeObject.top;
    
    switch(direction) {
      case 'up':
        newTop -= moveDistance;
        break;
      case 'down':
        newTop += moveDistance;
        break;
      case 'left':
        newLeft -= moveDistance;
        break;
      case 'right':
        newLeft += moveDistance;
        break;
      default:
        break;
    }
    
    activeObject.set({
      left: newLeft,
      top: newTop
    });
    
    activeObject.setCoords();
    canvas.renderAll();
    setDebugInfo(`객체 ${direction === 'up' ? '위' : direction === 'down' ? '아래' : direction === 'left' ? '왼쪽' : '오른쪽'}로 이동`);
  };

  // 타입별 객체 순환 선택 기능
  const selectObjectsByType = (type) => {
    const canvas = canvasObj.current;
    if (!canvas) return;
    
    let targetObjects = [];
    
    // 타입별로 객체 필터링
    canvas.getObjects().forEach(obj => {
      switch(type) {
        case 'wall':
          if (obj.type === 'rect' && obj.height === 8 && !obj.carbonizedArea && !obj.sootArea) {
            targetObjects.push(obj);
          }
          break;
        case 'door':
          if (obj.type === 'rect' && obj.fill === '#ffffff' && obj.stroke === '#000000') {
            targetObjects.push(obj);
          }
          break;
        case 'window':
          if (obj.type === 'rect' && obj.fill === 'transparent' && obj.strokeDashArray) {
            targetObjects.push(obj);
          }
          break;
        case 'outlet':
          if (obj.type === 'rect' && obj.fill === '#4CAF50') {
            targetObjects.push(obj);
          }
          break;
        case 'multitap':
          if (obj.type === 'rect' && obj.fill === '#9C27B0') {
            targetObjects.push(obj);
          }
          break;
        case 'breaker':
          if (obj.type === 'rect' && obj.fill === '#000000' && obj.width === 24) {
            targetObjects.push(obj);
          }
          break;
        case 'wire':
          if (obj.wireElement) {
            targetObjects.push(obj);
          }
          break;
        case 'burn':
          if (obj.type === 'group' && !obj.furnitureType) {
            targetObjects.push(obj);
          }
          break;
        case 'carbonized':
          if (obj.carbonizedArea) {
            targetObjects.push(obj);
          }
          break;
        case 'soot':
          if (obj.sootArea) {
            targetObjects.push(obj);
          }
          break;
        case 'evidence':
          if (obj.type === 'rect' && obj.fill === '#FFEB3B') {
            targetObjects.push(obj);
          }
          break;
        case 'furniture':
          if (type === 'furniture') {
            if (obj.furnitureType || (obj.type === 'group' && obj._objects && obj._objects[0] && obj._objects[0].furnitureType)) {
              targetObjects.push(obj);
            }
          }
          break;
        default:
          break;  
      }
    });
    
    if (targetObjects.length === 0) {
      setDebugInfo(`${type} 객체가 없습니다`);
      return;
    }
    
    // 현재 선택된 객체가 해당 타입인지 확인
    const currentActive = canvas.getActiveObject();
    let currentIndex = -1;
    
    if (currentActive) {
      currentIndex = targetObjects.indexOf(currentActive);
    }
    
    // 다음 객체 선택 (순환)
    const nextIndex = (currentIndex + 1) % targetObjects.length;
    const nextObject = targetObjects[nextIndex];
    
    canvas.setActiveObject(nextObject);
    canvas.renderAll();
    
    setDebugInfo(`${type} 객체 ${nextIndex + 1}/${targetObjects.length} 선택됨`);
  };
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

  // 저장 함수 (범례를 캔버스 크기에 맞춤)
  const saveProject = () => {
    const canvas = canvasObj.current;
    if (!canvas) return;
    
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    // 해상도 스케일 팩터 (2배 = 2x 해상도, 3배 = 3x 해상도)
    const scaleFactor = 8; // 이 값을 2, 3, 4 등으로 조정하여 해상도 변경
    
    // 현재 캔버스에 존재하는 객체 타입 확인
    const existingTypes = new Set();

    canvas.getObjects().forEach(obj => {
      if (obj.isGuideline) return; // 가이드라인 제외
      
      // 각 객체 타입 판별
      if (obj.type === 'rect' && obj.height === 8 && !obj.carbonizedArea && !obj.sootArea) {
        existingTypes.add('wall');
      } else if (obj.type === 'rect' && obj.fill === '#ffffff' && obj.stroke === '#000000') {
        existingTypes.add('door');
      } else if (obj.type === 'rect' && obj.fill === 'transparent' && obj.strokeDashArray) {
        existingTypes.add('window');
      } else if (obj.type === 'rect' && obj.fill === '#4CAF50') {
        existingTypes.add('outlet');
      } else if (obj.type === 'rect' && obj.fill === '#9C27B0') {
        existingTypes.add('multitap');
      } else if (obj.type === 'rect' && obj.fill === '#000000' && obj.width === 24) {
        existingTypes.add('breaker');
      } else if (obj.wireElement) {
        existingTypes.add('wire');
      } else if (obj.type === 'group') {
        existingTypes.add('burn');
      } else if (obj.carbonizedArea) {
        existingTypes.add('carbonized');
      } else if (obj.sootArea) {
        existingTypes.add('soot');
      } else if (obj.type === 'rect' && obj.fill === '#FFEB3B') {
        existingTypes.add('evidence');
      }

      if (obj.furnitureType || (obj.type === 'group' && obj._objects && obj._objects[0] && obj._objects[0].furnitureType)) {
        existingTypes.add('furniture');
      }

    });
    
    // 전체 범례 항목 정의
    const allLegendItems = [
      { type: 'wall', color: '#888888', text: '벽' },
      { type: 'door', color: '#ffffff', text: '문', hasStroke: true },
      { type: 'window', color: 'transparent', text: '창문', isWindow: true },
      { type: 'outlet', color: '#4CAF50', text: '콘센트' },
      { type: 'multitap', color: '#9C27B0', text: '멀티탭' },
      { type: 'breaker', color: '#000000', text: '차단기함' },
      { type: 'wire', color: '#0066cc', text: '전선' },
      { type: 'burn', color: '#ff0000', text: '용융흔' },
      { type: 'carbonized', color: 'rgba(204, 0, 0, 0.7)', text: '탄화면적' },
      { type: 'soot', color: 'rgba(255, 99, 99, 0.3)', text: '그을음피해' },
      { type: 'evidence', color: '#FFEB3B', text: '증거물' },
      { type: 'furniture', color: '#795548', text: '가구' },
    ];
    
    // 실제 존재하는 타입만 필터링
    const usedLegendItems = allLegendItems.filter(item => existingTypes.has(item.type));
    
    // 사용된 범례가 없으면 빈 범례 표시
    if (usedLegendItems.length === 0) {
      usedLegendItems.push({ type: 'empty', color: '#cccccc', text: '사용된 객체 없음' });
    }
    
    // 범례 높이 동적 계산 (사용된 항목 수에 따라)
    const legendRows = Math.ceil(usedLegendItems.length / 4);
    const legendHeight = Math.max(60, 40 + legendRows * 20);
    
    // 임시 캔버스 생성
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = canvasWidth * scaleFactor;
    tempCanvas.height = (canvasHeight + legendHeight) * scaleFactor;
    
    // 고품질 렌더링 설정
    tempCtx.imageSmoothingEnabled = true;
    tempCtx.imageSmoothingQuality = 'high';
    
    // 원본 캔버스 내용 복사
    const originalData = canvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: scaleFactor
    });
    const img = new Image();
    
    img.onload = () => {
      // 원본 캔버스를 스케일업해서 그리기
      tempCtx.drawImage(img, 0, 0, canvasWidth * scaleFactor, canvasHeight * scaleFactor);
      
      // 날짜 변수 선언
      const date = new Date().toLocaleString('ko-KR');
      
      // 범례 배경
      tempCtx.fillStyle = '#ffffff';
      tempCtx.fillRect(0, canvasHeight * scaleFactor, canvasWidth * scaleFactor, legendHeight * scaleFactor);
      tempCtx.strokeStyle = '#333333';
      tempCtx.lineWidth = 1 * scaleFactor;
      tempCtx.strokeRect(0, canvasHeight * scaleFactor, canvasWidth * scaleFactor, legendHeight * scaleFactor);
      
      // 범례 제목과 생성일시
      tempCtx.fillStyle = '#000000';
      tempCtx.font = `bold ${12 * scaleFactor}px Arial`;
      tempCtx.fillText(`범례 (사용된 객체 ${usedLegendItems.length}개) - 생성일시: ${date}`, 15 * scaleFactor, (canvasHeight + 18) * scaleFactor);
      
      // 사용된 범례 항목들만 배치
      const itemWidth = Math.max(60, canvasWidth / 5) * scaleFactor;
      
      usedLegendItems.forEach((item, index) => {
        const row = Math.floor(index / 4);
        const col = index % 4;
        const x = (15 + col * (itemWidth / scaleFactor)) * scaleFactor;
        const y = (canvasHeight + 35 + row * 20) * scaleFactor;
        
        if (x + itemWidth > canvasWidth * scaleFactor - 10 * scaleFactor) return;
        
        // 색상 박스 그리기
        if (item.isWindow) {
          tempCtx.strokeStyle = '#666666';
          tempCtx.setLineDash([2 * scaleFactor, 2 * scaleFactor]);
          tempCtx.strokeRect(x, y - 8 * scaleFactor, 12 * scaleFactor, 10 * scaleFactor);
          tempCtx.setLineDash([]);
        } else {
          tempCtx.fillStyle = item.color;
          tempCtx.fillRect(x, y - 8 * scaleFactor, 12 * scaleFactor, 10 * scaleFactor);
          if (item.hasStroke) {
            tempCtx.strokeStyle = item.strokeColor || '#000000';
            tempCtx.strokeRect(x, y - 8 * scaleFactor, 12 * scaleFactor, 10 * scaleFactor);
          }
        }
        
        // 텍스트
        tempCtx.fillStyle = '#000000';
        tempCtx.font = `${12 * scaleFactor}px Arial`;
        tempCtx.fillText(item.text, x + 16 * scaleFactor, y);
      });
      
      // 고품질 PNG로 다운로드
      const dataURL = tempCanvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.download = `화재조사_평면도_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setDebugInfo(`${usedLegendItems.length}개 사용된 범례와 함께 저장되었습니다`);
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
          <button 
            onClick={() => {
              setMode('furniture');
              setShowFurnitureMenu(!showFurnitureMenu);
            }} 
            style={{ 
              padding: isMobile ? '4px 8px' : '6px 10px', 
              background: mode === 'furniture' ? '#795548' : '#ddd', 
              color: mode === 'furniture' ? 'white' : 'black',
              fontSize: isMobile ? '10px' : '12px', 
              minWidth: isMobile ? '60px' : 'auto' 
            }}
          >
            🪑 가구
          </button>
        </div>
        
        {showFurnitureMenu && mode === 'furniture' && (
          <div style={{ 
            marginBottom: isMobile ? 4 : 8, 
            display: 'flex', 
            flexWrap: 'wrap', 
            justifyContent: 'center', 
            gap: '4px',
            padding: '8px',
            backgroundColor: '#f5f5f5',
            borderRadius: '4px',
            border: '1px solid #ddd'
          }}>
            {['소파', '냉장고', 'TV', '침대', '테이블', '세탁기'].map(furniture => (
              <button
                key={furniture}
                onClick={() => {
                  setSelectedFurniture(furniture);
                  setDebugInfo(`${furniture} 선택됨 - 캔버스에 드래그하여 배치하세요`);
                }}
                style={{
                  padding: isMobile ? '4px 8px' : '6px 10px',
                  background: selectedFurniture === furniture ? '#795548' : '#fff',
                  color: selectedFurniture === furniture ? 'white' : 'black',
                  border: '1px solid #999',
                  borderRadius: '4px',
                  fontSize: isMobile ? '10px' : '11px',
                  minWidth: isMobile ? '50px' : '60px',
                  cursor: 'pointer'
                }}
              >
                {furniture}
              </button>
            ))}
          </div>
        )}
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

        <div style={{ marginBottom: isMobile ? 4 : 8, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px' }}>
          <button onClick={() => setMode('')} style={{ padding: isMobile ? '4px 8px' : '6px 10px', background: mode === '' ? '#bbb' : '#eee', fontSize: isMobile ? '10px' : '12px', minWidth: isMobile ? '60px' : 'auto' }}>↔️ 선택</button>
          
          <button onClick={deleteSelected} style={{ padding: isMobile ? '4px 8px' : '6px 10px', background: '#ff4444', color: 'white', fontSize: isMobile ? '10px' : '12px', minWidth: isMobile ? '60px' : 'auto' }}>🗑️ 삭제</button>
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
      
      {/* 하단 영역: 범례(좌측) + 방향키(우측) */}
      <div style={{
        marginTop: 12,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '20px',
        flexWrap: isMobile ? 'wrap' : 'nowrap'
      }}>
        
        {/* 클릭 가능한 범례 (좌측) */}
        <div style={{
          flex: '1',
          minWidth: isMobile ? '100%' : '300px',
          maxWidth: isMobile ? '100%' : '400px'
        }}>
          <div style={{ 
            fontSize: isMobile ? '11px' : '13px', 
            fontWeight: 'bold', 
            marginBottom: '8px',
            color: '#333'
          }}>
            📋 범례 (클릭하여 객체 선택)
          </div>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)',
            gap: '4px',
            fontSize: isMobile ? '9px' : '10px'
          }}>

            {[
              { type: 'wall', color: '#888888', text: '벽', onClick: () => selectObjectsByType('wall') },
              { type: 'door', color: '#ffffff', text: '문', hasStroke: true, onClick: () => selectObjectsByType('door') },
              { type: 'window', color: 'transparent', text: '창문', isWindow: true, onClick: () => selectObjectsByType('window') },
              { type: 'outlet', color: '#4CAF50', text: '콘센트', onClick: () => selectObjectsByType('outlet') },
              { type: 'multitap', color: '#9C27B0', text: '멀티탭', onClick: () => selectObjectsByType('multitap') },
              { type: 'breaker', color: '#000000', text: '차단기함', onClick: () => selectObjectsByType('breaker') },
              { type: 'wire', color: '#0066cc', text: '전선', onClick: () => selectObjectsByType('wire') },
              { type: 'burn', color: '#ff0000', text: '용융흔', onClick: () => selectObjectsByType('burn') },
              { type: 'carbonized', color: 'rgba(204, 0, 0, 0.7)', text: '탄화면적', onClick: () => selectObjectsByType('carbonized') },
              { type: 'soot', color: 'rgba(255, 99, 99, 0.3)', text: '그을음피해', onClick: () => selectObjectsByType('soot') },
              { type: 'evidence', color: '#FFEB3B', text: '증거물', onClick: () => selectObjectsByType('evidence') },
              { type: 'furniture', color: '#795548', text: '가구', onClick: () => selectObjectsByType('furniture') },
            ].map((item, index) => (
              <button
                key={index}
                onClick={item.onClick}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 6px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  background: '#f9f9f9',
                  cursor: 'pointer',
                  fontSize: 'inherit',
                  minHeight: '24px'
                }}
                onMouseOver={(e) => e.target.style.background = '#e3f2fd'}
                onMouseOut={(e) => e.target.style.background = '#f9f9f9'}
              >
                <div
                  style={{
                    width: '12px',
                    height: '8px',
                    backgroundColor: item.isWindow ? 'transparent' : item.color,
                    border: item.hasStroke || item.isWindow ? '1px solid #666' : item.color === 'transparent' ? '1px solid #ddd' : 'none',
                    borderStyle: item.isWindow ? 'dashed' : 'solid',
                    flexShrink: 0
                  }}
                />
                <span style={{ whiteSpace: 'nowrap' }}>{item.text}</span>
              </button>
            ))}
          </div>
        </div>
        
        {/* 객체 미세 이동 버튼들 (우측) */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          gap: '4px',
          minWidth: isMobile ? '100%' : '120px'
        }}>
          <div style={{ fontSize: isMobile ? '11px' : '13px', fontWeight: 'bold', marginBottom: '8px' }}>
            🎯 미세 이동
          </div>
          
          {/* 위쪽 버튼 */}
          <button 
            onClick={() => moveSelectedObject('up')}
            style={{ 
              padding: '6px 12px', 
              background: '#2196F3', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              fontSize: isMobile ? '11px' : '12px',
              cursor: 'pointer'
            }}
          >
            ↑ 위
          </button>
          
          {/* 좌우 버튼 */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => moveSelectedObject('left')}
              style={{ 
                padding: '6px 12px', 
                background: '#2196F3', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                fontSize: isMobile ? '11px' : '12px',
                cursor: 'pointer'
              }}
            >
              ← 왼쪽
            </button>
            <button 
              onClick={() => moveSelectedObject('right')}
              style={{ 
                padding: '6px 12px', 
                background: '#2196F3', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                fontSize: isMobile ? '11px' : '12px',
                cursor: 'pointer'
              }}
            >
              오른쪽 →
            </button>
          </div>
          
          {/* 아래쪽 버튼 */}
          <button 
            onClick={() => moveSelectedObject('down')}
            style={{ 
              padding: '6px 12px', 
              background: '#2196F3', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              fontSize: isMobile ? '11px' : '12px',
              cursor: 'pointer'
            }}
          >
            ↓ 아래
          </button>
        </div>
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