#import <Foundation/Foundation.h>
#import <AVFoundation/AVFoundation.h>
#import <AppKit/AppKit.h>

// Local-only inspection utility. Samples frames without changing the source video.
int main(int argc, const char *argv[]) {
  @autoreleasepool {
    if (argc != 3) return 2;
    NSURL *url = [NSURL fileURLWithPath:[NSString stringWithUTF8String:argv[1]]];
    NSString *directory = [NSString stringWithUTF8String:argv[2]];
    AVURLAsset *asset = [AVURLAsset URLAssetWithURL:url options:nil];
    double duration = CMTimeGetSeconds(asset.duration);
    if (!isfinite(duration) || duration <= 0) return 3;
    printf("duration=%.3f\n", duration);
    AVAssetImageGenerator *generator = [AVAssetImageGenerator assetImageGeneratorWithAsset:asset];
    generator.appliesPreferredTrackTransform = YES;
    generator.requestedTimeToleranceBefore = kCMTimeZero;
    generator.requestedTimeToleranceAfter = kCMTimeZero;
    [[NSFileManager defaultManager] createDirectoryAtPath:directory withIntermediateDirectories:YES attributes:nil error:nil];
    for (int i = 0; i < 9; i++) {
      CMTime time = CMTimeMakeWithSeconds(duration * (double)i / 9.0, 600);
      NSError *error = nil;
      CGImageRef image = [generator copyCGImageAtTime:time actualTime:NULL error:&error];
      if (!image) { fprintf(stderr, "frame %d: %s\n", i, error.localizedDescription.UTF8String); continue; }
      NSBitmapImageRep *bitmap = [[NSBitmapImageRep alloc] initWithCGImage:image];
      NSData *jpeg = [bitmap representationUsingType:NSBitmapImageFileTypeJPEG properties:@{NSImageCompressionFactor:@0.8}];
      NSString *path = [directory stringByAppendingPathComponent:[NSString stringWithFormat:@"frame-%02d.jpg", i]];
      if ([jpeg writeToFile:path atomically:YES]) printf("%s\n", path.UTF8String);
      CGImageRelease(image);
    }
  }
  return 0;
}
