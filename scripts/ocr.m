#import <Foundation/Foundation.h>
#import <Vision/Vision.h>

int main(int argc, const char * argv[]) {
  @autoreleasepool {
    if (argc != 2) return 2;
    NSURL *url = [NSURL fileURLWithPath:[NSString stringWithUTF8String:argv[1]]];
    VNRecognizeTextRequest *request = [[VNRecognizeTextRequest alloc] init];
    request.recognitionLevel = VNRequestTextRecognitionLevelAccurate;
    request.recognitionLanguages = @[@"zh-Hans", @"en-US"];
    request.usesLanguageCorrection = YES;
    NSData *image = [NSData dataWithContentsOfURL:url];
    if (!image) { fputs("Image unavailable\n", stderr); return 1; }
    VNImageRequestHandler *handler = [[VNImageRequestHandler alloc] initWithData:image options:@{}];
    NSError *error = nil;
    if (![handler performRequests:@[request] error:&error]) {
      fprintf(stderr, "OCR unavailable: %s\n", error.localizedDescription.UTF8String ?: "unknown error");
      return 1;
    }
    NSMutableArray *lines = [NSMutableArray array];
    for (VNRecognizedTextObservation *observation in request.results) {
      VNRecognizedText *text = [[observation topCandidates:1] firstObject];
      if (text.string) [lines addObject:text.string];
    }
    NSData *data = [NSJSONSerialization dataWithJSONObject:@{@"text":[lines componentsJoinedByString:@"\n"],@"engine":@"Apple Vision · 本机识别"} options:0 error:&error];
    if (!data) return 1;
    puts([[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding].UTF8String);
  }
  return 0;
}
