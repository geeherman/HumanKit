9.0.0
=====

- factory renaming:
  - objectTree -> humanObjectTree,
  - Tree -> HumanCollection,
  - ObjectTree -> SceneObjects,
  - ObjectTreeRendered -> ObjectRendered,
  - ObjectTreeEnabled -> ObjectEnabled,
  - ObjectTreeSelected -> ObjectSelected * MAJOR * [scene-objects]

- adds ObjectRendered#addHandlers and ObjectRendered#removeHandlers * MINOR * [scene-objects]

- adds HumanKeySelect factory * MINOR * [scene-objects]

- adds humanObjectList, humanObjectListSearch directives * MINOR * [scene-objects]

- updates engine math functions in getPanRate and humanCameraClip * PATCH * [scene-objects]

- fixes hasAnimations * PATCH * [scene-objects]