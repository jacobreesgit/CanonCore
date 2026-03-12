/**
 * WebGL shader background component.
 * Animated 3D shader effect using react-three-fiber.
 * Used as fallback when no artwork is available.
 * Respects prefers-reduced-motion for accessibility.
 */

"use client";

import type { HTMLAttributes } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useReducedMotion } from "motion/react";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import { cn } from "@/lib/utils";

interface ShaderPlaneProps {
  vertexShader: string;
  fragmentShader: string;
  uniforms: { [key: string]: { value: unknown } };
}

const ShaderPlane = ({
  vertexShader,
  fragmentShader,
  uniforms,
}: ShaderPlaneProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { size } = useThree();

  useFrame((state) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      material.uniforms.u_time.value = state.clock.elapsedTime * 0.5;
      material.uniforms.u_resolution.value.set(size.width, size.height, 1.0);
    }
  });

  return (
    <mesh ref={meshRef}>
      {/* eslint-disable-next-line react/no-unknown-property */}
      <planeGeometry args={[2, 2]} />
      {/* eslint-disable react/no-unknown-property */}
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={THREE.FrontSide}
        depthTest={false}
        depthWrite={false}
      />
      {/* eslint-enable react/no-unknown-property */}
    </mesh>
  );
};

interface ShaderBackgroundProps extends HTMLAttributes<HTMLElement> {
  vertexShader?: string;
  fragmentShader?: string;
  uniforms?: { [key: string]: { value: unknown } };
  className?: string;
  color?: string;
}

/**
 * Animated shader background with customizable color.
 * Renders a fullscreen WebGL shader effect using Three.js.
 *
 * @param vertexShader - Custom vertex shader (optional)
 * @param fragmentShader - Custom fragment shader (optional)
 * @param uniforms - Additional shader uniforms (optional)
 * @param className - Additional CSS classes
 * @param color - Base color for the shader effect (default: blue)
 */
const Shader1 = ({
  vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
    gl_Position = vec4(position, 1.0);
    }
  `,
  fragmentShader = `
    precision highp float;

    varying vec2 vUv;
    uniform float u_time;
    uniform vec3 u_resolution;
    uniform vec3 u_color;
    uniform sampler2D u_channel0;

  	#define t (u_time * 0.5)
  	mat2 m(float a){float c=cos(a), s=sin(a);return mat2(c,-s,s,c);}
  	float map(vec3 p){
  		p.xz*= m(t*0.4);p.xy*= m(t*0.3);
  		vec3 q = p*2.+t;
  		return length(p+vec3(sin(t*0.7)))*log(length(p)+1.) + sin(q.x+sin(q.z+sin(q.y)))*2.5 - 0.5;
  	}

  	void mainImage( out vec4 fragColor, in vec2 fragCoord ){
  		vec2 p = fragCoord.xy/u_resolution.y - vec2(.9,.5);
  		vec3 cl = vec3(0.);
  		float d = .9;
  		for(int i=0; i<=5; i++)	{
  			vec3 p = vec3(0,0,5.) + normalize(vec3(p, -1.))*d;
  			float rz = map(p);
  			float f =  clamp((rz - map(p+.1))*0.5, -.1, 1. );

        vec3 base = u_color * 0.25;
        vec3 bright = u_color * 1.75;

        vec3 l = base + bright * f;
  			cl = cl*l + (1.-smoothstep(0., 2.5, rz))*.7*l;
  			d += min(rz, 1.);
  		}
  		fragColor = vec4(cl * u_color, 1.0);	}

      void main() {
        vec4 fragColor;
        vec2 fragCoord = vUv * u_resolution.xy;
        mainImage(fragColor, fragCoord);
        gl_FragColor = fragColor;
      }
  `,
  uniforms = {},
  className,
  color = "#0000ff",
  ...restProps
}: ShaderBackgroundProps) => {
  const shouldReduceMotion = useReducedMotion();

  const shaderUniforms = useMemo(
    () => ({
      u_time: { value: 0 },
      u_resolution: { value: new THREE.Vector3(1, 1, 1) },
      u_color: { value: new THREE.Color(color) },
      ...uniforms,
    }),
    [uniforms, color]
  );

  // Show static gradient when reduced motion is preferred
  if (shouldReduceMotion) {
    return (
      <section className={cn("absolute inset-0", className)} {...restProps}>
        <div className="h-full w-full bg-gradient-to-br from-blue-900 via-purple-900 to-slate-900" />
      </section>
    );
  }

  return (
    <section className={cn("absolute inset-0", className)} {...restProps}>
      <Canvas>
        <ShaderPlane
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={shaderUniforms}
        />
      </Canvas>
    </section>
  );
};

export { Shader1 };
