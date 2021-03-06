import * as PropTypes from 'prop-types';
import * as React from 'react';
import { Graph } from '../../main/Options';
import { Navbar, Button } from '../ui';
import { Context } from '../Context';
import { VisualizerProps } from '../VisualizerProps';
import { Edge } from './Edge';
import { Node } from './Node';
import {
  ATTRACTION_RATIO,
  EDGE_LENGTH,
  EDGE_SPRING,
  NODE_RADIUS,
  PHYSICS_DURATION,
  PHYSICS_ITERATION,
  VIEW_HEIGHT_BASE,
  VIEW_HEIGHT_COEFFICIENT,
  ZOOM_MAX,
  ZOOM_MIN,
} from './constants';

interface Props {
  graph: Graph;
}

export const Visualizer: React.FC<Props & VisualizerProps> = ({ graph, width, height }) => {
  const context = React.useContext(Context);

  const svgRef = React.useRef<SVGSVGElement>();
  const handleCopySvg = React.useCallback(() => {
    if (!svgRef.current) {
      return;
    }
    if (!navigator.clipboard) {
      console.error('navigator.clipboard is undefined.');
      return;
    }
    navigator.clipboard.writeText(svgRef.current.outerHTML);
  }, [svgRef]);

  const [viewX, setViewX] = React.useState(0);
  const [viewY, setViewY] = React.useState(0);
  const [zoom, setZoom] = React.useState(0);
  const viewHeight = React.useMemo(() => VIEW_HEIGHT_COEFFICIENT * Math.pow(VIEW_HEIGHT_BASE, zoom), [
    width,
    height,
    zoom,
  ]);
  const viewWidth = React.useMemo(() => viewHeight * (width / height), [width, height, viewHeight]);

  const [pointerX, setPointerX] = React.useState(0);
  const [pointerY, setPointerY] = React.useState(0);
  const [isDown, setIsDown] = React.useState(false);
  const [downTarget, setDownTarget] = React.useState(-1);

  const adjacencyMatrix = React.useMemo(() => {
    const m = [...Array(graph.nodes.length)].map(() => Array(graph.nodes.length).fill(false));
    graph.edges.forEach(([from, to]) => {
      m[from][to] = true;
      if (!graph.directed) m[to][from] = true;
    });
    return m;
  }, [graph]);

  const [nodeStates, setNodeStates] = React.useState<{ x: number; y: number }[]>(
    [...Array(graph.nodes.length)].map(() => ({
      x: Math.random() * VIEW_HEIGHT_COEFFICIENT,
      y: Math.random() * VIEW_HEIGHT_COEFFICIENT,
    }))
  );
  const [modifiedAt, setModifiedAt] = React.useState(new Date());
  const [isPhysicsEnabled, setIsPhysicsEnabled] = React.useState(true);
  const handleTogglePhysics = React.useCallback(() => {
    setIsPhysicsEnabled(!isPhysicsEnabled);
    setModifiedAt(new Date());
  }, [isPhysicsEnabled, setIsPhysicsEnabled, setModifiedAt]);
  React.useEffect(() => {
    if (!isPhysicsEnabled) return;
    if (new Date().getTime() > modifiedAt.getTime() + PHYSICS_DURATION) return;

    const intervalId = setInterval(() => {
      if (new Date().getTime() > modifiedAt.getTime() + PHYSICS_DURATION) {
        clearInterval(intervalId);
        return;
      }

      for (let iteration = 0; iteration < PHYSICS_ITERATION; iteration++) {
        for (let i = 0; i < graph.nodes.length; i++) {
          if (isDown && i === downTarget) continue;
          nodeStates[i].x *= 1 - ATTRACTION_RATIO;
          nodeStates[i].y *= 1 - ATTRACTION_RATIO;
        }
        for (let i = 0; i < graph.nodes.length; i++) {
          for (let j = 0; j < graph.nodes.length; j++) {
            if (i === j) continue;
            const lx = nodeStates[j].x - nodeStates[i].x;
            const ly = nodeStates[j].y - nodeStates[i].y;
            const l = Math.sqrt(lx * lx + ly * ly);
            if (l <= EDGE_LENGTH || adjacencyMatrix[i][j]) {
              const dx = (lx - (lx / l) * EDGE_LENGTH) * EDGE_SPRING;
              const dy = (ly - (ly / l) * EDGE_LENGTH) * EDGE_SPRING;
              if (isDown && i === downTarget) {
                nodeStates[j].x -= dx;
                nodeStates[j].y -= dy;
              } else if (isDown && j === downTarget) {
                nodeStates[i].x += dx;
                nodeStates[i].y += dy;
              } else {
                nodeStates[i].x += dx / 2;
                nodeStates[i].y += dy / 2;
                nodeStates[j].x -= dx / 2;
                nodeStates[j].y -= dy / 2;
              }
            }
          }
        }
      }
      setNodeStates(nodeStates);
    }, 1000 / context.fps);

    return () => {
      clearInterval(intervalId);
    };
  }, [isPhysicsEnabled, isDown, downTarget, nodeStates, modifiedAt, adjacencyMatrix]);

  const onPointerMove = React.useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      let x = viewX - viewWidth / 2 + event.clientX * (viewHeight / height);
      let y = viewY - viewHeight / 2 + event.clientY * (viewHeight / height);

      if (isDown) {
        if (downTarget < 0) {
          setViewX(viewX - (x - pointerX));
          setViewY(viewY - (y - pointerY));
          x = pointerX;
          y = pointerY;
        } else {
          nodeStates[downTarget] = {
            x: nodeStates[downTarget].x + (x - pointerX),
            y: nodeStates[downTarget].y + (y - pointerY),
          };
          setNodeStates(nodeStates);
          setModifiedAt(new Date());
        }
      } else {
        const i = nodeStates.findIndex(e => {
          const dx = x - e.x;
          const dy = y - e.y;
          return dx * dx + dy * dy <= NODE_RADIUS * NODE_RADIUS;
        });
        setDownTarget(i);
      }

      setPointerX(x);
      setPointerY(y);
    },
    [
      height,
      setViewX,
      setViewY,
      viewWidth,
      viewHeight,
      pointerX,
      setPointerX,
      pointerY,
      setPointerY,
      isDown,
      downTarget,
      setDownTarget,
      nodeStates,
      setNodeStates,
      setModifiedAt,
    ]
  );

  const onPointerDown = React.useCallback(() => {
    setIsDown(true);
  }, [setIsDown]);

  const onPointerUp = React.useCallback(() => {
    setIsDown(false);
  }, []);

  const onWheel = React.useCallback(
    (event: React.WheelEvent<SVGSVGElement>) => {
      if (event.deltaY === 0) return;
      setZoom(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom + (event.deltaY < 0 ? -1 : 1))));
    },
    [zoom, setZoom]
  );

  const multiEdgeCount = new Map<number, number>();
  const multiEdgeFraction: [number, number][] = [];
  graph.edges.forEach(([from, to], i) => {
    const key = graph.edges.length * Math.min(from, to) + Math.max(from, to);
    if (!multiEdgeCount.has(key)) multiEdgeCount.set(key, 0);
    const c = multiEdgeCount.get(key);
    multiEdgeCount.set(key, c + 1);
    multiEdgeFraction[i] = [c, undefined];
  });
  graph.edges.forEach(([from, to], i) => {
    multiEdgeFraction[i][1] = multiEdgeCount.get(graph.edges.length * Math.min(from, to) + Math.max(from, to));
  });

  const isEdgesHovered = graph.edges.map(([from, to]) => from === downTarget || (!graph.directed && to === downTarget));

  return (
    <>
      <Navbar>
        <Button onClick={handleCopySvg}>Copy SVG</Button>
        <Button onClick={handleTogglePhysics}>{isPhysicsEnabled ? 'Disable' : 'Enable'} Physics</Button>
      </Navbar>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`${viewX - viewWidth / 2} ${viewY - viewHeight / 2} ${viewWidth} ${viewHeight}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onWheel={onWheel}
      >
        <g>
          {graph.edges.map(([from, to, label], index) => (
            <Edge
              key={index}
              x1={nodeStates[from].x}
              y1={nodeStates[from].y}
              x2={nodeStates[to].x}
              y2={nodeStates[to].y}
              directed={graph.directed}
              variant={(to < from ? -1 : 1) * (-(multiEdgeFraction[index][1] - 1) / 2 + multiEdgeFraction[index][0])}
              label={label}
              hovered={isEdgesHovered[index]}
            />
          ))}
        </g>

        <g>
          {graph.nodes.map((label, index) => (
            <Node
              key={index}
              x={nodeStates[index].x}
              y={nodeStates[index].y}
              label={label}
              hovered={index === downTarget}
            />
          ))}
        </g>
      </svg>
    </>
  );
};

Visualizer.propTypes = {
  graph: PropTypes.any.isRequired,
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
};
