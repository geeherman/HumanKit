// Generated by Apple Swift version 4.2.1 effective-4.1.50 (swiftlang-1000.11.42 clang-1000.11.45.1)
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wgcc-compat"

#if !defined(__has_include)
# define __has_include(x) 0
#endif
#if !defined(__has_attribute)
# define __has_attribute(x) 0
#endif
#if !defined(__has_feature)
# define __has_feature(x) 0
#endif
#if !defined(__has_warning)
# define __has_warning(x) 0
#endif

#if __has_include(<swift/objc-prologue.h>)
# include <swift/objc-prologue.h>
#endif

#pragma clang diagnostic ignored "-Wauto-import"
#include <objc/NSObject.h>
#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>

#if !defined(SWIFT_TYPEDEFS)
# define SWIFT_TYPEDEFS 1
# if __has_include(<uchar.h>)
#  include <uchar.h>
# elif !defined(__cplusplus)
typedef uint_least16_t char16_t;
typedef uint_least32_t char32_t;
# endif
typedef float swift_float2  __attribute__((__ext_vector_type__(2)));
typedef float swift_float3  __attribute__((__ext_vector_type__(3)));
typedef float swift_float4  __attribute__((__ext_vector_type__(4)));
typedef double swift_double2  __attribute__((__ext_vector_type__(2)));
typedef double swift_double3  __attribute__((__ext_vector_type__(3)));
typedef double swift_double4  __attribute__((__ext_vector_type__(4)));
typedef int swift_int2  __attribute__((__ext_vector_type__(2)));
typedef int swift_int3  __attribute__((__ext_vector_type__(3)));
typedef int swift_int4  __attribute__((__ext_vector_type__(4)));
typedef unsigned int swift_uint2  __attribute__((__ext_vector_type__(2)));
typedef unsigned int swift_uint3  __attribute__((__ext_vector_type__(3)));
typedef unsigned int swift_uint4  __attribute__((__ext_vector_type__(4)));
#endif

#if !defined(SWIFT_PASTE)
# define SWIFT_PASTE_HELPER(x, y) x##y
# define SWIFT_PASTE(x, y) SWIFT_PASTE_HELPER(x, y)
#endif
#if !defined(SWIFT_METATYPE)
# define SWIFT_METATYPE(X) Class
#endif
#if !defined(SWIFT_CLASS_PROPERTY)
# if __has_feature(objc_class_property)
#  define SWIFT_CLASS_PROPERTY(...) __VA_ARGS__
# else
#  define SWIFT_CLASS_PROPERTY(...)
# endif
#endif

#if __has_attribute(objc_runtime_name)
# define SWIFT_RUNTIME_NAME(X) __attribute__((objc_runtime_name(X)))
#else
# define SWIFT_RUNTIME_NAME(X)
#endif
#if __has_attribute(swift_name)
# define SWIFT_COMPILE_NAME(X) __attribute__((swift_name(X)))
#else
# define SWIFT_COMPILE_NAME(X)
#endif
#if __has_attribute(objc_method_family)
# define SWIFT_METHOD_FAMILY(X) __attribute__((objc_method_family(X)))
#else
# define SWIFT_METHOD_FAMILY(X)
#endif
#if __has_attribute(noescape)
# define SWIFT_NOESCAPE __attribute__((noescape))
#else
# define SWIFT_NOESCAPE
#endif
#if __has_attribute(warn_unused_result)
# define SWIFT_WARN_UNUSED_RESULT __attribute__((warn_unused_result))
#else
# define SWIFT_WARN_UNUSED_RESULT
#endif
#if __has_attribute(noreturn)
# define SWIFT_NORETURN __attribute__((noreturn))
#else
# define SWIFT_NORETURN
#endif
#if !defined(SWIFT_CLASS_EXTRA)
# define SWIFT_CLASS_EXTRA
#endif
#if !defined(SWIFT_PROTOCOL_EXTRA)
# define SWIFT_PROTOCOL_EXTRA
#endif
#if !defined(SWIFT_ENUM_EXTRA)
# define SWIFT_ENUM_EXTRA
#endif
#if !defined(SWIFT_CLASS)
# if __has_attribute(objc_subclassing_restricted)
#  define SWIFT_CLASS(SWIFT_NAME) SWIFT_RUNTIME_NAME(SWIFT_NAME) __attribute__((objc_subclassing_restricted)) SWIFT_CLASS_EXTRA
#  define SWIFT_CLASS_NAMED(SWIFT_NAME) __attribute__((objc_subclassing_restricted)) SWIFT_COMPILE_NAME(SWIFT_NAME) SWIFT_CLASS_EXTRA
# else
#  define SWIFT_CLASS(SWIFT_NAME) SWIFT_RUNTIME_NAME(SWIFT_NAME) SWIFT_CLASS_EXTRA
#  define SWIFT_CLASS_NAMED(SWIFT_NAME) SWIFT_COMPILE_NAME(SWIFT_NAME) SWIFT_CLASS_EXTRA
# endif
#endif

#if !defined(SWIFT_PROTOCOL)
# define SWIFT_PROTOCOL(SWIFT_NAME) SWIFT_RUNTIME_NAME(SWIFT_NAME) SWIFT_PROTOCOL_EXTRA
# define SWIFT_PROTOCOL_NAMED(SWIFT_NAME) SWIFT_COMPILE_NAME(SWIFT_NAME) SWIFT_PROTOCOL_EXTRA
#endif

#if !defined(SWIFT_EXTENSION)
# define SWIFT_EXTENSION(M) SWIFT_PASTE(M##_Swift_, __LINE__)
#endif

#if !defined(OBJC_DESIGNATED_INITIALIZER)
# if __has_attribute(objc_designated_initializer)
#  define OBJC_DESIGNATED_INITIALIZER __attribute__((objc_designated_initializer))
# else
#  define OBJC_DESIGNATED_INITIALIZER
# endif
#endif
#if !defined(SWIFT_ENUM_ATTR)
# if defined(__has_attribute) && __has_attribute(enum_extensibility)
#  define SWIFT_ENUM_ATTR(_extensibility) __attribute__((enum_extensibility(_extensibility)))
# else
#  define SWIFT_ENUM_ATTR(_extensibility)
# endif
#endif
#if !defined(SWIFT_ENUM)
# define SWIFT_ENUM(_type, _name, _extensibility) enum _name : _type _name; enum SWIFT_ENUM_ATTR(_extensibility) SWIFT_ENUM_EXTRA _name : _type
# if __has_feature(generalized_swift_name)
#  define SWIFT_ENUM_NAMED(_type, _name, SWIFT_NAME, _extensibility) enum _name : _type _name SWIFT_COMPILE_NAME(SWIFT_NAME); enum SWIFT_COMPILE_NAME(SWIFT_NAME) SWIFT_ENUM_ATTR(_extensibility) SWIFT_ENUM_EXTRA _name : _type
# else
#  define SWIFT_ENUM_NAMED(_type, _name, SWIFT_NAME, _extensibility) SWIFT_ENUM(_type, _name, _extensibility)
# endif
#endif
#if !defined(SWIFT_UNAVAILABLE)
# define SWIFT_UNAVAILABLE __attribute__((unavailable))
#endif
#if !defined(SWIFT_UNAVAILABLE_MSG)
# define SWIFT_UNAVAILABLE_MSG(msg) __attribute__((unavailable(msg)))
#endif
#if !defined(SWIFT_AVAILABILITY)
# define SWIFT_AVAILABILITY(plat, ...) __attribute__((availability(plat, __VA_ARGS__)))
#endif
#if !defined(SWIFT_DEPRECATED)
# define SWIFT_DEPRECATED __attribute__((deprecated))
#endif
#if !defined(SWIFT_DEPRECATED_MSG)
# define SWIFT_DEPRECATED_MSG(...) __attribute__((deprecated(__VA_ARGS__)))
#endif
#if __has_feature(attribute_diagnose_if_objc)
# define SWIFT_DEPRECATED_OBJC(Msg) __attribute__((diagnose_if(1, Msg, "warning")))
#else
# define SWIFT_DEPRECATED_OBJC(Msg) SWIFT_DEPRECATED_MSG(Msg)
#endif
#if __has_feature(modules)
@import CoreGraphics;
@import Foundation;
@import ObjectiveC;
@import UIKit;
@import WebKit;
#endif

#pragma clang diagnostic ignored "-Wproperty-attribute-mismatch"
#pragma clang diagnostic ignored "-Wduplicate-method-arg"
#if __has_warning("-Wpragma-clang-attribute")
# pragma clang diagnostic ignored "-Wpragma-clang-attribute"
#endif
#pragma clang diagnostic ignored "-Wunknown-pragmas"
#pragma clang diagnostic ignored "-Wnullability"

#if __has_attribute(external_source_symbol)
# pragma push_macro("any")
# undef any
# pragma clang attribute push(__attribute__((external_source_symbol(language="Swift", defined_in="HumanKit",generated_declaration))), apply_to=any(function,enum,objc_interface,objc_category,objc_protocol))
# pragma pop_macro("any")
#endif

/// Enumerated background option possible values
typedef SWIFT_ENUM(NSInteger, BackgroundOptions, closed) {
/// a circular gradient from the center to the outside of the screen
  BackgroundOptionsRadial = 0,
/// a linear gradient from the top to the bottom of the screen
  BackgroundOptionsLinear = 1,
};




/// Annotation object
SWIFT_CLASS("_TtC8HumanKit12HKAnnotation")
@interface HKAnnotation : NSObject
/// annotation title
@property (nonatomic, copy) NSString * _Nonnull title;
/// annotation description
@property (nonatomic, copy) NSString * _Nonnull info;
/// objectID if the annotation is attached to an object, otherwise an empty string
@property (nonatomic, copy) NSString * _Nonnull objectID;
- (nonnull instancetype)initWithTitle:(NSString * _Nonnull)title info:(NSString * _Nonnull)info objectID:(NSString * _Nonnull)objectID OBJC_DESIGNATED_INITIALIZER;
- (nonnull instancetype)init SWIFT_UNAVAILABLE;
+ (nonnull instancetype)new SWIFT_DEPRECATED_MSG("-init is unavailable");
@end


/// Camera object
SWIFT_CLASS("_TtC8HumanKit8HKCamera")
@interface HKCamera : NSObject
/// A structure containing info about the Camera’s position and orientation
/// <h3>Example:</h3>
/// \code
/// camInfo: ["up": ["y": 1.0, "x": 1.98008641e-11, "z": 3.87674831e-12], "eye": ["y": 16.8392124, "x": -3.69088221, "z": -3.31774855], "look": ["y": 16.7719669, "x": -1.41448975, "z": -1.44309437]]
///
/// \endcode
@property (nonatomic, copy) NSDictionary<NSString *, NSDictionary<NSString *, NSNumber *> *> * _Nonnull camInfo;
/// the current zoom factor of the camera
@property (nonatomic) double zoom;
- (nonnull instancetype)init OBJC_DESIGNATED_INITIALIZER;
@end


/// HKChapter object
SWIFT_CLASS("_TtC8HumanKit9HKChapter")
@interface HKChapter : NSObject
/// chapter title
@property (nonatomic, copy) NSString * _Nonnull title;
/// chapter description
@property (nonatomic, copy) NSString * _Nonnull info;
/// chapter order, starts at 0
@property (nonatomic) NSInteger index;
- (nonnull instancetype)initWithTitle:(NSString * _Nonnull)title info:(NSString * _Nonnull)info index:(NSInteger)index OBJC_DESIGNATED_INITIALIZER;
- (nonnull instancetype)init SWIFT_UNAVAILABLE;
+ (nonnull instancetype)new SWIFT_DEPRECATED_MSG("-init is unavailable");
@end


/// HKModule object
SWIFT_CLASS("_TtC8HumanKit8HKModule")
@interface HKModule : NSObject
/// ID of the module.  example: production/maleAdult/flu.json
@property (nonatomic, copy) NSString * _Nonnull moduleID;
/// module title
@property (nonatomic, copy) NSString * _Nonnull title;
/// module description
@property (nonatomic, copy) NSString * _Nonnull info;
/// url of thumbnail image
@property (nonatomic, copy) NSString * _Nonnull thumbnail;
- (nonnull instancetype)initWithModuleID:(NSString * _Nonnull)moduleID title:(NSString * _Nonnull)title info:(NSString * _Nonnull)info thumb:(NSString * _Nonnull)thumb OBJC_DESIGNATED_INITIALIZER;
- (nonnull instancetype)init SWIFT_UNAVAILABLE;
+ (nonnull instancetype)new SWIFT_DEPRECATED_MSG("-init is unavailable");
@end

@protocol HumanBodyDelegate;
@class UIView;
enum HumanUIOptions : NSInteger;
@class UIColor;

/// The BioDigital Human 3D View object and API
SWIFT_CLASS("_TtC8HumanKit9HumanBody")
@interface HumanBody : NSObject
/// The delegate object
/// <ul>
///   <li>
///     Set this to have access to the callback functions in your app
///   </li>
/// </ul>
@property (nonatomic, strong) id <HumanBodyDelegate> _Nullable delegate;
/// The title of the current loaded Module.
@property (nonatomic, copy) NSString * _Nonnull moduleTitle;
/// The description of the current loaded Module.
@property (nonatomic, copy) NSString * _Nonnull moduleDescription;
/// A Boolean indicating if there is supposed to be a visible playPause button in the module
@property (nonatomic) BOOL hasPlayPause;
/// A Boolean indicating if there is supposed to be a visible timeline scrubber in the module
@property (nonatomic) BOOL hasScrubber;
/// The currently loaded Chapter to access title and description
@property (nonatomic, strong) HKChapter * _Nullable currentChapter;
/// A map of chapter IDs to HKChapter objects.
@property (nonatomic, copy) NSDictionary<NSString *, HKChapter *> * _Nonnull chapters;
/// An ordered list of chapter IDs
@property (nonatomic, copy) NSArray<NSString *> * _Nonnull chapterList;
/// The current animation time
@property (nonatomic) float currentTime;
/// A flat unordered list of visible objects in the current scene
@property (nonatomic, copy) NSArray<NSString *> * _Nonnull objectIDs;
/// A map of objectIDs to display names
@property (nonatomic, copy) NSDictionary<NSString *, NSString *> * _Nonnull objects;
/// A map of annotation IDs to Annotation objects
@property (nonatomic, copy) NSDictionary<NSString *, HKAnnotation *> * _Nonnull annotations;
/// Initialize the Human Body with a view and the default UI options
- (nonnull instancetype)initWithView:(UIView * _Nonnull)view OBJC_DESIGNATED_INITIALIZER;
/// Set one UI variable to true or false
/// \param option a value from the enum HumanUIOptions
///
/// \param value true or false
///
- (void)setupUIWithOption:(enum HumanUIOptions)option value:(BOOL)value;
- (void)engineVersion;
/// Loads a BioDigital Human 3D module.
/// \param model The moduleID string
///
/// \param callback A closure to run after the module is loaded
///
- (void)loadWithModel:(NSString * _Nonnull)model callback:(void (^ _Nonnull)(void))callback;
/// Loads “about:blank” to clear the webview
- (void)unload;
/// Loads index.html, which is an empty scene
/// \param callback A closure to run after the empty screen is loaded
///
- (void)loadIndexWithCallback:(void (^ _Nonnull)(void))callback;
/// Get a list of Module objects by ICD Number
/// \param ICD String version of ICD number
///
///
/// returns:
/// [HKModule] an array of found Module objects, empty if none are found
- (NSArray<HKModule *> * _Nonnull)findModuleWithICD:(NSString * _Nonnull)ICD SWIFT_WARN_UNUSED_RESULT;
/// Brings up the built-in iOS share UI with the current contents of the view
- (void)shareFrom:(CGRect)from;
/// Eventually calls a callback returning a UIImage
- (void)screenshot;
/// Change the background style with two specified colors
/// \param top Primary color
///
/// \param bottom Secondary color
///
/// \param bgType (optional) Background style (BackgroundOptions.radial or BackgroundOptions.linear, default is .radial)
///
- (void)setBackgroundColorWithTop:(UIColor * _Nonnull)top bottom:(UIColor * _Nonnull)bottom type:(enum BackgroundOptions)type;
/// Change the object highlight color
/// \param color Selected objects are yellow by default, set this to use a different color
///
- (void)setHighlightColorWithColor:(UIColor * _Nonnull)color;
/// Reset the camera and objects to the current scene/chapter’s original state
- (void)resetScene;
/// Turn xray mode ON or OFF in the current scene
/// \param enabled A boolean to turn xray mode ON or OFF
///
- (void)xrayWithEnabled:(BOOL)enabled;
/// Turn isolate mode ON or OFF in the current scene
/// \param enabled A boolean to turn isolate mode ON or OFF
///
- (void)isolateWithEnabled:(BOOL)enabled;
/// Turn dissect mode ON or OFF in the current scene
/// \param enabled A boolean to turn dissect mode ON or OFF
///
- (void)dissectWithEnabled:(BOOL)enabled;
/// Undo the last dissect
- (void)undo;
/// Get an object’s screen position
/// \param objectID A valid object ID string
///
///
/// returns:
/// the screen position of the center of the object with the given ID as [x,y]
- (NSArray<NSNumber *> * _Nonnull)getObjectPositionWithObjectID:(NSString * _Nonnull)objectID SWIFT_WARN_UNUSED_RESULT;
/// Select an object programatically
/// \param objectID the object you want to select
///
- (void)selectObjectWithObjectID:(NSString * _Nonnull)objectID;
/// Deselect all objects in the scene
- (void)undoSelections;
- (void)play;
/// Pause the current scene’s animation
- (void)pause;
/// Unpause the current scene’s animation
- (void)unpause;
/// Jump to the current module’s next chapter
- (void)nextChapter;
/// Jump to the current module’s previous chapter
- (void)prevChapter;
/// Jump to the chapter with the given chapterID
- (void)moveToChapterWithChapterID:(NSString * _Nonnull)chapterID;
/// Jump to the given time in the current scene’s current animation
/// <ul>
///   <li>
///     Parameter: time animation offset in seconds
///   </li>
/// </ul>
- (void)moveToTimeWithTime:(float)time;
/// Check if there is an animation playing
///
/// returns:
/// is the current scene playing an animation?
- (BOOL)playing SWIFT_WARN_UNUSED_RESULT;
/// Check the current animation length
///
/// returns:
/// time in seconds of the current animation’s total length as a Float
- (float)duration SWIFT_WARN_UNUSED_RESULT;
/// Get current camera information.
///
/// returns:
/// current camera information (eye, look, up, and zoom) as a Camera object
- (HKCamera * _Nonnull)getCameraInfo SWIFT_WARN_UNUSED_RESULT;
/// Pan camera by offset in world space.
/// \param x offset on x axis
///
/// \param y offset on y axis
///
/// \param z offset on z axis
///
- (void)panWithX:(float)x y:(float)y z:(float)z;
/// Zoom the camera in and out of its point of focus.
/// \param factor Zoom factor between 0 and 1
///
- (void)zoomWithFactor:(float)factor;
/// Orbit around camera’s current point of focus.
/// \param yaw Yaw angle (degrees)
///
/// \param pitch Pitch angle (degrees)
///
/// \param duration Time of orbit animation (seconds)
///
- (void)orbitWithYaw:(float)yaw pitch:(float)pitch duration:(float)duration;
/// Updates camera position.
/// \param eye The new camera eye vector.
///
/// \param look The new camera eye vector.
///
/// \param animated If true, camera will animate from current position to new position
///
- (void)updateCameraWithEye:(NSArray<NSNumber *> * _Nonnull)eye look:(NSArray<NSNumber *> * _Nonnull)look animated:(BOOL)animated;
/// Lock or unlock the camera rotation around the Y axis
/// \param lock boolean
///
- (void)lockCameraWithLock:(BOOL)lock;
/// Animates camera to object specified by its id.
/// \param objectId Object id specified by string
///
- (void)animateToObjectId:(NSString * _Nonnull)objectId;
/// Shows all annotations in the current scene, and enables future annotations to appear, this is the default behavior
- (void)showAnnotations;
/// Hides all annotations and disables future annotations from appearing, until showAnnotations() is called
- (void)hideAnnotations;
/// Highlight an object
/// \param objectid object to highlight
///
- (void)highlightObjectWithObjectid:(NSString * _Nonnull)objectid;
/// Prevent objects from being selected
- (void)disablePicking;
/// Allow objects to be selected
- (void)enablePicking;
/// Enables labels to appear when an object is selected, this is the default behavior, unless disabled
- (void)showLabels;
/// Hides all object labels and disables future labels from appearing on selected objects
- (void)hideLabels;
- (nonnull instancetype)init SWIFT_UNAVAILABLE;
+ (nonnull instancetype)new SWIFT_DEPRECATED_MSG("-init is unavailable");
@end

@class UIImage;

/// The optional delegate callback functions
SWIFT_PROTOCOL("_TtP8HumanKit17HumanBodyDelegate_")
@protocol HumanBodyDelegate
@optional
/// Callback when the validation process succeeds
- (void)onValidSDK;
/// Callback when the current animation is finished playing
- (void)onAnimationComplete;
/// Callback when load() is called and the validation process has failed
- (void)onInvalidSDK;
/// Callback when an object has been selected
/// \param objectId the ID of the selected object
///
/// \param view the HumanBody object in which the object was selected
///
- (void)onObjectSelectedWithObjectId:(NSString * _Nonnull)objectId view:(HumanBody * _Nonnull)view;
- (void)onObjectDeselectedWithObjectId:(NSString * _Nonnull)objectId view:(HumanBody * _Nonnull)view;
/// Callback when a chapter has been loaded
/// \param chapterId the ID of the chapter, for lookup in the chapters map
///
/// \param view the HumanBody object in which the transition occurred
///
- (void)onChapterTransitionWithChapterId:(NSString * _Nonnull)chapterId view:(HumanBody * _Nonnull)view;
/// Callback when a screenshot has been generated
/// \param image the UIImage screenshot
///
- (void)screenshotWithImage:(UIImage * _Nonnull)image;
@end

/// Enumerated language options for HumanBody
typedef SWIFT_ENUM(NSInteger, HumanLanguage, closed) {
  HumanLanguageEnglish = 0,
  HumanLanguageSpanish = 1,
  HumanLanguageArabic = 2,
};

@protocol HumanMindDelegate;

/// The BioDigital Human backend services
SWIFT_CLASS("_TtC8HumanKit9HumanMind")
@interface HumanMind : NSObject
@property (nonatomic, strong) id <HumanMindDelegate> _Nullable delegate;
@property (nonatomic, copy) NSArray<HKModule *> * _Nonnull modules;
/// Initialize the backend in your AppDelegate
/// \param validateKey your SDK key, generated at http://developer.biodigital.com
///
- (nonnull instancetype)initWithValidateKey:(NSString * _Nonnull)validateKey secret:(NSString * _Nonnull)secret OBJC_DESIGNATED_INITIALIZER;
/// Stops the backend service, this should ONLY be done when your app is going to stop running
- (void)stop;
/// Restarts the backend service, this should ONLY be done when your app is returning to the foreground
- (void)restart;
/// Returns the json string for a module if it is on disk
- (NSString * _Nonnull)getJsonStringForModule:(NSString * _Nonnull)forModule SWIFT_WARN_UNUSED_RESULT;
/// Returns the json string for a module if it is on disk
- (NSData * _Nonnull)getJsonDataForModule:(NSString * _Nonnull)forModule SWIFT_WARN_UNUSED_RESULT;
/// Removes all stored BioDigital Human content from the device
- (void)forgetAboutIt;
/// Set the language, default is HumanLanguage.english
/// valid options are spanish and arabic
- (void)setLanguageTo:(enum HumanLanguage)to;
- (nonnull instancetype)init SWIFT_UNAVAILABLE;
+ (nonnull instancetype)new SWIFT_DEPRECATED_MSG("-init is unavailable");
@end


SWIFT_PROTOCOL("_TtP8HumanKit17HumanMindDelegate_")
@protocol HumanMindDelegate
- (void)modulesLoaded;
@end

/// Enumerated ui option flags you can set to true or false
typedef SWIFT_ENUM(NSInteger, HumanUIOptions, closed) {
/// shows a panel of tools (xray, dissect, isolate, and cross section)
  HumanUIOptionsTools = 0,
/// show the current module/chapter information and chapter navigation UI
  HumanUIOptionsInfo = 1,
/// show UI for interacting with animations (play/pause, timeline slider)
  HumanUIOptionsAnimation = 2,
/// show a selectable list of objects in the scene
  HumanUIOptionsObjects = 3,
/// show a slider that turns off anatomical layers in the scene
  HumanUIOptionsSlider = 4,
/// show a button that returns the scene to its original state.
  HumanUIOptionsReset = 5,
/// turn all of the widget UI elements OFF only. You need to turn them on individually.
  HumanUIOptionsAll = 6,
};





#if __has_attribute(external_source_symbol)
# pragma clang attribute pop
#endif
#pragma clang diagnostic pop
