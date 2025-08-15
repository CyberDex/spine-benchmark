import { 
  Animation,
  DeformTimeline,
  IkConstraintTimeline,
  PathConstraintMixTimeline,
  PathConstraintPositionTimeline,
  PathConstraintSpacingTimeline,
  PhysicsConstraintTimeline,
  Spine,
  TransformConstraintTimeline,
  MeshAttachment,
  ClippingAttachment,
  Physics
} from "@esotericsoftware/spine-pixi-v8";

export interface ActiveComponents {
  slots: Set<string>;
  meshes: Set<string>;
  bones: Set<string>;
  hasClipping: boolean;
  hasBlendModes: boolean;
  hasPhysics: boolean;
  hasIK: boolean;
  hasTransform: boolean;
  hasPath: boolean;
  activeConstraints: {
    physics: Set<string>;
    ik: Set<string>;
    transform: Set<string>;
    path: Set<string>;
  };
}

/**
 * Determines which components are active/used in a specific animation by sampling frames
 */
export function getActiveComponentsForAnimation(
  spineInstance: Spine, 
  animation: Animation
): ActiveComponents {
  const skeleton = spineInstance.skeleton;
  const state = spineInstance.state;
  
  const activeComponents: ActiveComponents = {
    slots: new Set<string>(),
    meshes: new Set<string>(),
    bones: new Set<string>(),
    hasClipping: false,
    hasBlendModes: false,
    hasPhysics: false,
    hasIK: false,
    hasTransform: false,
    hasPath: false,
    activeConstraints: {
      physics: new Set<string>(),
      ik: new Set<string>(),
      transform: new Set<string>(),
      path: new Set<string>()
    }
  };

  // Store current state
  const currentAnimationTrack0 = state.getCurrent(0);
  const currentTime = currentAnimationTrack0 ? currentAnimationTrack0.trackTime : 0;
  
  // Clear and set the animation we want to analyze
  state.clearTrack(0);
  state.setAnimation(0, animation.name, false);
  
  // Sample the animation at multiple points
  const duration = animation.duration;
  const sampleRate = 30; // Sample at 30fps
  const samples = Math.max(1, Math.ceil(duration * sampleRate));
  
  console.log(`Sampling animation "${animation.name}" - duration: ${duration}s, samples: ${samples + 1}`);
  
  for (let i = 0; i <= samples; i++) {
    const time = (i / samples) * duration;
    
    // Set track time and apply
    const track = state.getCurrent(0);
    if (track) {
      track.trackTime = time;
      track.animationLast = time;
      track.animationEnd = duration;
    }
    
    // Apply the animation state
    state.update(0);
    state.apply(skeleton);
    skeleton.updateWorldTransform(Physics.update);
    
    // Analyze current frame
    analyzeFrameState(skeleton, activeComponents);
  }
  
  // Also check which constraints are actually keyframed in this animation
  analyzeAnimationTimelines(animation, skeleton, activeComponents);
  
  // Restore original animation state
  state.clearTrack(0);
  if (currentAnimationTrack0 && currentAnimationTrack0.animation) {
    state.setAnimation(0, currentAnimationTrack0.animation.name, currentAnimationTrack0.loop);
    const restoredTrack = state.getCurrent(0);
    if (restoredTrack) {
      restoredTrack.trackTime = currentTime;
      restoredTrack.animationLast = currentTime;
      state.update(0);
      state.apply(skeleton);
    }
  }
  
  console.log(`Completed analysis of "${animation.name}": found ${activeComponents.slots.size} active slots, ${activeComponents.meshes.size} meshes`);
  
  return activeComponents;
}

/**
 * Analyzes the current frame state to detect active components
 */
function analyzeFrameState(skeleton: any, activeComponents: ActiveComponents): void {
  // Check all slots
  skeleton.slots.forEach((slot: any) => {
    // Skip if slot is not visible (alpha = 0 or attachment is null)
    if (slot.color.a === 0) return;
    
    const attachment = slot.getAttachment();
    if (!attachment) return;
    
    // Slot is visible and has attachment
    activeComponents.slots.add(slot.data.name);
    
    // Check attachment type
    if (attachment instanceof MeshAttachment) {
      activeComponents.meshes.add(`${slot.data.name}:${attachment.name}`);
    } else if (attachment instanceof ClippingAttachment) {
      activeComponents.hasClipping = true;
    }
    
    // Check blend mode
    if (slot.data.blendMode !== 0) { // 0 is Normal
      activeComponents.hasBlendModes = true;
    }
    
    // Track bones that affect this slot
    let bone = slot.bone;
    while (bone) {
      activeComponents.bones.add(bone.data.name);
      bone = bone.parent;
    }
  });
  
  // Check active constraints
  
  // IK Constraints
  skeleton.ikConstraints.forEach((constraint: any) => {
    if (constraint.isActive() && constraint.mix > 0) {
      activeComponents.hasIK = true;
      activeComponents.activeConstraints.ik.add(constraint.data.name);
      
      // Add bones affected by this constraint
      constraint.bones.forEach((bone: any) => {
        activeComponents.bones.add(bone.data.name);
      });
    }
  });
  
  // Transform Constraints
  skeleton.transformConstraints.forEach((constraint: any) => {
    if (constraint.isActive()) {
      const hasEffect = constraint.mixRotate > 0 || 
                       constraint.mixX > 0 || 
                       constraint.mixY > 0 || 
                       constraint.mixScaleX > 0 || 
                       constraint.mixScaleY > 0 || 
                       constraint.mixShearY > 0;
      
      if (hasEffect) {
        activeComponents.hasTransform = true;
        activeComponents.activeConstraints.transform.add(constraint.data.name);
        
        constraint.bones.forEach((bone: any) => {
          activeComponents.bones.add(bone.data.name);
        });
      }
    }
  });
  
  // Path Constraints
  skeleton.pathConstraints.forEach((constraint: any) => {
    if (constraint.isActive() && (constraint.mixRotate > 0 || constraint.mixX > 0 || constraint.mixY > 0)) {
      activeComponents.hasPath = true;
      activeComponents.activeConstraints.path.add(constraint.data.name);
      
      constraint.bones.forEach((bone: any) => {
        activeComponents.bones.add(bone.data.name);
      });
    }
  });
  
  // Physics Constraints
  if (skeleton.physicsConstraints) {
    skeleton.physicsConstraints.forEach((constraint: any) => {
      if (constraint.isActive() && constraint.mix > 0) {
        activeComponents.hasPhysics = true;
        activeComponents.activeConstraints.physics.add(constraint.data.name);
        
        if (constraint.bone) {
          activeComponents.bones.add(constraint.bone.data.name);
        }
      }
    });
  }
}

/**
 * Analyzes animation timelines to ensure we catch all potentially active constraints
 */
function analyzeAnimationTimelines(
  animation: Animation,
  skeleton: any,
  activeComponents: ActiveComponents
): void {
  animation.timelines.forEach(timeline => {
    // Check constraint timelines to ensure we don't miss any
    if (timeline instanceof IkConstraintTimeline) {
      const constraintIndex = (timeline as any).ikConstraintIndex;
      const constraint = skeleton.ikConstraints[constraintIndex];
      if (constraint) {
        // Even if not currently active, mark it as used in this animation
        activeComponents.hasIK = true;
        activeComponents.activeConstraints.ik.add(constraint.data.name);
      }
    } else if (timeline instanceof TransformConstraintTimeline) {
      const constraintIndex = (timeline as any).transformConstraintIndex;
      const constraint = skeleton.transformConstraints[constraintIndex];
      if (constraint) {
        activeComponents.hasTransform = true;
        activeComponents.activeConstraints.transform.add(constraint.data.name);
      }
    } else if (timeline instanceof PathConstraintMixTimeline ||
               timeline instanceof PathConstraintPositionTimeline ||
               timeline instanceof PathConstraintSpacingTimeline) {
      const constraintIndex = (timeline as any).pathConstraintIndex;
      const constraint = skeleton.pathConstraints[constraintIndex];
      if (constraint) {
        activeComponents.hasPath = true;
        activeComponents.activeConstraints.path.add(constraint.data.name);
      }
    } else if (timeline instanceof PhysicsConstraintTimeline) {
      const constraintIndex = (timeline as any).physicsConstraintIndex;
      const constraint = skeleton.physicsConstraints?.[constraintIndex];
      if (constraint) {
        activeComponents.hasPhysics = true;
        activeComponents.activeConstraints.physics.add(constraint.data.name);
      }
    }
    
    // Check for deform timelines
    else if (timeline instanceof DeformTimeline) {
      const slotIndex = (timeline as any).slotIndex;
      const slot = skeleton.slots[slotIndex];
      const attachment = (timeline as any).attachment;
      
      if (slot && attachment) {
        activeComponents.slots.add(slot.data.name);
        if (attachment instanceof MeshAttachment) {
          activeComponents.meshes.add(`${slot.data.name}:${attachment.name}`);
        }
      }
    }
  });
}