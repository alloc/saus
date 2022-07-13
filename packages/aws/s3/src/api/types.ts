// Adapted from https://github.com/aws/aws-sdk-js/blob/76fe0f61949f7bf26436f00312c6f8cf20cbe33a/clients/s3.d.ts
export interface Blob {}

export interface StreamingEventStream<Events> extends NodeJS.ReadableStream {
  on(event: 'data', listener: (event: Events) => void): this
  on(event: string, listener: Function): this
}

export type EventStream<Events> = StreamingEventStream<Events> | Events[]

export namespace S3 {
  export type AbortDate = Date
  export interface AbortIncompleteMultipartUpload {
    /**
     * Specifies the number of days after which Amazon S3 aborts an incomplete multipart upload.
     */
    DaysAfterInitiation?: DaysAfterInitiation
  }
  export interface AbortMultipartUploadOutput {
    RequestCharged?: RequestCharged
  }
  export interface AbortMultipartUploadRequest {
    /**
     * The bucket name to which the upload was taking place.  When using this action with an access point, you must direct requests to the access point hostname. The access point hostname takes the form AccessPointName-AccountId.s3-accesspoint.Region.amazonaws.com. When using this action with an access point through the Amazon Web Services SDKs, you provide the access point ARN in place of the bucket name. For more information about access point ARNs, see Using access points in the Amazon S3 User Guide. When using this action with Amazon S3 on Outposts, you must direct requests to the S3 on Outposts hostname. The S3 on Outposts hostname takes the form  AccessPointName-AccountId.outpostID.s3-outposts.Region.amazonaws.com. When using this action with S3 on Outposts through the Amazon Web Services SDKs, you provide the Outposts bucket ARN in place of the bucket name. For more information about S3 on Outposts ARNs, see Using Amazon S3 on Outposts in the Amazon S3 User Guide.
     */
    Bucket: BucketName
    /**
     * Key of the object for which the multipart upload was initiated.
     */
    Key: ObjectKey
    /**
     * Upload ID that identifies the multipart upload.
     */
    UploadId: MultipartUploadId
    RequestPayer?: RequestPayer
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export type AbortRuleId = string
  export interface AccelerateConfiguration {
    /**
     * Specifies the transfer acceleration status of the bucket.
     */
    Status?: BucketAccelerateStatus
  }
  export type AcceptRanges = string
  export interface AccessControlPolicy {
    /**
     * A list of grants.
     */
    Grants?: Grants
    /**
     * Container for the bucket owner's display name and ID.
     */
    Owner?: Owner
  }
  export interface AccessControlTranslation {
    /**
     * Specifies the replica ownership. For default and valid values, see PUT bucket replication in the Amazon S3 API Reference.
     */
    Owner: OwnerOverride
  }
  export type AccessPointArn = string
  export type AccountId = string
  export type AllowQuotedRecordDelimiter = boolean
  export type AllowedHeader = string
  export type AllowedHeaders = AllowedHeader[]
  export type AllowedMethod = string
  export type AllowedMethods = AllowedMethod[]
  export type AllowedOrigin = string
  export type AllowedOrigins = AllowedOrigin[]
  export interface AnalyticsAndOperator {
    /**
     * The prefix to use when evaluating an AND predicate: The prefix that an object must have to be included in the metrics results.
     */
    Prefix?: Prefix
    /**
     * The list of tags to use when evaluating an AND predicate.
     */
    Tags?: TagSet
  }
  export interface AnalyticsConfiguration {
    /**
     * The ID that identifies the analytics configuration.
     */
    Id: AnalyticsId
    /**
     * The filter used to describe a set of objects for analyses. A filter must have exactly one prefix, one tag, or one conjunction (AnalyticsAndOperator). If no filter is provided, all objects will be considered in any analysis.
     */
    Filter?: AnalyticsFilter
    /**
     *  Contains data related to access patterns to be collected and made available to analyze the tradeoffs between different storage classes.
     */
    StorageClassAnalysis: StorageClassAnalysis
  }
  export type AnalyticsConfigurationList = AnalyticsConfiguration[]
  export interface AnalyticsExportDestination {
    /**
     * A destination signifying output to an S3 bucket.
     */
    S3BucketDestination: AnalyticsS3BucketDestination
  }
  export interface AnalyticsFilter {
    /**
     * The prefix to use when evaluating an analytics filter.
     */
    Prefix?: Prefix
    /**
     * The tag to use when evaluating an analytics filter.
     */
    Tag?: Tag
    /**
     * A conjunction (logical AND) of predicates, which is used in evaluating an analytics filter. The operator must have at least two predicates.
     */
    And?: AnalyticsAndOperator
  }
  export type AnalyticsId = string
  export interface AnalyticsS3BucketDestination {
    /**
     * Specifies the file format used when exporting data to Amazon S3.
     */
    Format: AnalyticsS3ExportFileFormat
    /**
     * The account ID that owns the destination S3 bucket. If no account ID is provided, the owner is not validated before exporting data.   Although this value is optional, we strongly recommend that you set it to help prevent problems if the destination bucket ownership changes.
     */
    BucketAccountId?: AccountId
    /**
     * The Amazon Resource Name (ARN) of the bucket to which data is exported.
     */
    Bucket: BucketName
    /**
     * The prefix to use when exporting data. The prefix is prepended to all results.
     */
    Prefix?: Prefix
  }
  export type AnalyticsS3ExportFileFormat = 'CSV' | string
  export type ArchiveStatus = 'ARCHIVE_ACCESS' | 'DEEP_ARCHIVE_ACCESS' | string
  export type Body = Buffer
  export interface Bucket {
    /**
     * The name of the bucket.
     */
    Name?: BucketName
    /**
     * Date the bucket was created. This date can change when making changes to your bucket, such as editing its bucket policy.
     */
    CreationDate?: CreationDate
  }
  export type BucketAccelerateStatus = 'Enabled' | 'Suspended' | string
  export type BucketCannedACL =
    | 'private'
    | 'public-read'
    | 'public-read-write'
    | 'authenticated-read'
    | string
  export type BucketKeyEnabled = boolean
  export interface BucketLifecycleConfiguration {
    /**
     * A lifecycle rule for individual objects in an Amazon S3 bucket.
     */
    Rules: LifecycleRules
  }
  export type BucketLocationConstraint =
    | 'af-south-1'
    | 'ap-east-1'
    | 'ap-northeast-1'
    | 'ap-northeast-2'
    | 'ap-northeast-3'
    | 'ap-south-1'
    | 'ap-southeast-1'
    | 'ap-southeast-2'
    | 'ca-central-1'
    | 'cn-north-1'
    | 'cn-northwest-1'
    | 'EU'
    | 'eu-central-1'
    | 'eu-north-1'
    | 'eu-south-1'
    | 'eu-west-1'
    | 'eu-west-2'
    | 'eu-west-3'
    | 'me-south-1'
    | 'sa-east-1'
    | 'us-east-2'
    | 'us-gov-east-1'
    | 'us-gov-west-1'
    | 'us-west-1'
    | 'us-west-2'
    | string
  export interface BucketLoggingStatus {
    LoggingEnabled?: LoggingEnabled
  }
  export type BucketLogsPermission = 'FULL_CONTROL' | 'READ' | 'WRITE' | string
  export type BucketName = string
  export type BucketVersioningStatus = 'Enabled' | 'Suspended' | string
  export type Buckets = Bucket[]
  export type BypassGovernanceRetention = boolean
  export type BytesProcessed = number
  export type BytesReturned = number
  export type BytesScanned = number
  export interface CORSConfiguration {
    /**
     * A set of origins and methods (cross-origin access that you want to allow). You can add up to 100 rules to the configuration.
     */
    CORSRules: CORSRules
  }
  export interface CORSRule {
    /**
     * Unique identifier for the rule. The value cannot be longer than 255 characters.
     */
    ID?: ID
    /**
     * Headers that are specified in the Access-Control-Request-Headers header. These headers are allowed in a preflight OPTIONS request. In response to any preflight OPTIONS request, Amazon S3 returns any requested headers that are allowed.
     */
    AllowedHeaders?: AllowedHeaders
    /**
     * An HTTP method that you allow the origin to execute. Valid values are GET, PUT, HEAD, POST, and DELETE.
     */
    AllowedMethods: AllowedMethods
    /**
     * One or more origins you want customers to be able to access the bucket from.
     */
    AllowedOrigins: AllowedOrigins
    /**
     * One or more headers in the response that you want customers to be able to access from their applications (for example, from a JavaScript XMLHttpRequest object).
     */
    ExposeHeaders?: ExposeHeaders
    /**
     * The time in seconds that your browser is to cache the preflight response for the specified resource.
     */
    MaxAgeSeconds?: MaxAgeSeconds
  }
  export type CORSRules = CORSRule[]
  export interface CSVInput {
    /**
     * Describes the first line of input. Valid values are:    NONE: First line is not a header.    IGNORE: First line is a header, but you can't use the header values to indicate the column in an expression. You can use column position (such as _1, _2, …) to indicate the column (SELECT s._1 FROM OBJECT s).    Use: First line is a header, and you can use the header value to identify a column in an expression (SELECT "name" FROM OBJECT).
     */
    FileHeaderInfo?: FileHeaderInfo
    /**
     * A single character used to indicate that a row should be ignored when the character is present at the start of that row. You can specify any character to indicate a comment line.
     */
    Comments?: Comments
    /**
     * A single character used for escaping the quotation mark character inside an already escaped value. For example, the value """ a , b """ is parsed as " a , b ".
     */
    QuoteEscapeCharacter?: QuoteEscapeCharacter
    /**
     * A single character used to separate individual records in the input. Instead of the default value, you can specify an arbitrary delimiter.
     */
    RecordDelimiter?: RecordDelimiter
    /**
     * A single character used to separate individual fields in a record. You can specify an arbitrary delimiter.
     */
    FieldDelimiter?: FieldDelimiter
    /**
     * A single character used for escaping when the field delimiter is part of the value. For example, if the value is a, b, Amazon S3 wraps this field value in quotation marks, as follows: " a , b ". Type: String Default: "  Ancestors: CSV
     */
    QuoteCharacter?: QuoteCharacter
    /**
     * Specifies that CSV field values may contain quoted record delimiters and such records should be allowed. Default value is FALSE. Setting this value to TRUE may lower performance.
     */
    AllowQuotedRecordDelimiter?: AllowQuotedRecordDelimiter
  }
  export interface CSVOutput {
    /**
     * Indicates whether to use quotation marks around output fields.     ALWAYS: Always use quotation marks for output fields.    ASNEEDED: Use quotation marks for output fields when needed.
     */
    QuoteFields?: QuoteFields
    /**
     * The single character used for escaping the quote character inside an already escaped value.
     */
    QuoteEscapeCharacter?: QuoteEscapeCharacter
    /**
     * A single character used to separate individual records in the output. Instead of the default value, you can specify an arbitrary delimiter.
     */
    RecordDelimiter?: RecordDelimiter
    /**
     * The value used to separate individual fields in a record. You can specify an arbitrary delimiter.
     */
    FieldDelimiter?: FieldDelimiter
    /**
     * A single character used for escaping when the field delimiter is part of the value. For example, if the value is a, b, Amazon S3 wraps this field value in quotation marks, as follows: " a , b ".
     */
    QuoteCharacter?: QuoteCharacter
  }
  export type CacheControl = string
  export interface Checksum {
    /**
     * The base64-encoded, 32-bit CRC32 checksum of the object. This will only be present if it was uploaded with the object. With multipart uploads, this may not be a checksum value of the object. For more information about how checksums are calculated with multipart uploads, see  Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumCRC32?: ChecksumCRC32
    /**
     * The base64-encoded, 32-bit CRC32C checksum of the object. This will only be present if it was uploaded with the object. With multipart uploads, this may not be a checksum value of the object. For more information about how checksums are calculated with multipart uploads, see  Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumCRC32C?: ChecksumCRC32C
    /**
     * The base64-encoded, 160-bit SHA-1 digest of the object. This will only be present if it was uploaded with the object. With multipart uploads, this may not be a checksum value of the object. For more information about how checksums are calculated with multipart uploads, see  Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumSHA1?: ChecksumSHA1
    /**
     * The base64-encoded, 256-bit SHA-256 digest of the object. This will only be present if it was uploaded with the object. With multipart uploads, this may not be a checksum value of the object. For more information about how checksums are calculated with multipart uploads, see  Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumSHA256?: ChecksumSHA256
  }
  export type ChecksumAlgorithm =
    | 'CRC32'
    | 'CRC32C'
    | 'SHA1'
    | 'SHA256'
    | string
  export type ChecksumAlgorithmList = ChecksumAlgorithm[]
  export type ChecksumCRC32 = string
  export type ChecksumCRC32C = string
  export type ChecksumMode = 'ENABLED' | string
  export type ChecksumSHA1 = string
  export type ChecksumSHA256 = string
  export type CloudFunction = string
  export interface CloudFunctionConfiguration {
    Id?: NotificationId
    Event?: Event
    /**
     * Bucket events for which to send notifications.
     */
    Events?: EventList
    /**
     * Lambda cloud function ARN that Amazon S3 can invoke when it detects events of the specified type.
     */
    CloudFunction?: CloudFunction
    /**
     * The role supporting the invocation of the Lambda function
     */
    InvocationRole?: CloudFunctionInvocationRole
  }
  export type CloudFunctionInvocationRole = string
  export type Code = string
  export type Comments = string
  export interface CommonPrefix {
    /**
     * Container for the specified common prefix.
     */
    Prefix?: Prefix
  }
  export type CommonPrefixList = CommonPrefix[]
  export interface CompleteMultipartUploadOutput {
    /**
     * The URI that identifies the newly created object.
     */
    Location?: Location
    /**
     * The name of the bucket that contains the newly created object. Does not return the access point ARN or access point alias if used. When using this action with an access point, you must direct requests to the access point hostname. The access point hostname takes the form AccessPointName-AccountId.s3-accesspoint.Region.amazonaws.com. When using this action with an access point through the Amazon Web Services SDKs, you provide the access point ARN in place of the bucket name. For more information about access point ARNs, see Using access points in the Amazon S3 User Guide. When using this action with Amazon S3 on Outposts, you must direct requests to the S3 on Outposts hostname. The S3 on Outposts hostname takes the form  AccessPointName-AccountId.outpostID.s3-outposts.Region.amazonaws.com. When using this action with S3 on Outposts through the Amazon Web Services SDKs, you provide the Outposts bucket ARN in place of the bucket name. For more information about S3 on Outposts ARNs, see Using Amazon S3 on Outposts in the Amazon S3 User Guide.
     */
    Bucket?: BucketName
    /**
     * The object key of the newly created object.
     */
    Key?: ObjectKey
    /**
     * If the object expiration is configured, this will contain the expiration date (expiry-date) and rule ID (rule-id). The value of rule-id is URL-encoded.
     */
    Expiration?: Expiration
    /**
     * Entity tag that identifies the newly created object's data. Objects with different object data will have different entity tags. The entity tag is an opaque string. The entity tag may or may not be an MD5 digest of the object data. If the entity tag is not an MD5 digest of the object data, it will contain one or more nonhexadecimal characters and/or will consist of less than 32 or more than 32 hexadecimal digits. For more information about how the entity tag is calculated, see Checking object integrity in the Amazon S3 User Guide.
     */
    ETag?: ETag
    /**
     * The base64-encoded, 32-bit CRC32 checksum of the object. This will only be present if it was uploaded with the object. With multipart uploads, this may not be a checksum value of the object. For more information about how checksums are calculated with multipart uploads, see  Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumCRC32?: ChecksumCRC32
    /**
     * The base64-encoded, 32-bit CRC32C checksum of the object. This will only be present if it was uploaded with the object. With multipart uploads, this may not be a checksum value of the object. For more information about how checksums are calculated with multipart uploads, see  Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumCRC32C?: ChecksumCRC32C
    /**
     * The base64-encoded, 160-bit SHA-1 digest of the object. This will only be present if it was uploaded with the object. With multipart uploads, this may not be a checksum value of the object. For more information about how checksums are calculated with multipart uploads, see  Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumSHA1?: ChecksumSHA1
    /**
     * The base64-encoded, 256-bit SHA-256 digest of the object. This will only be present if it was uploaded with the object. With multipart uploads, this may not be a checksum value of the object. For more information about how checksums are calculated with multipart uploads, see  Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumSHA256?: ChecksumSHA256
    /**
     * If you specified server-side encryption either with an Amazon S3-managed encryption key or an Amazon Web Services KMS key in your initiate multipart upload request, the response includes this header. It confirms the encryption algorithm that Amazon S3 used to encrypt the object.
     */
    ServerSideEncryption?: ServerSideEncryption
    /**
     * Version ID of the newly created object, in case the bucket has versioning turned on.
     */
    VersionId?: ObjectVersionId
    /**
     * If present, specifies the ID of the Amazon Web Services Key Management Service (Amazon Web Services KMS) symmetric customer managed key that was used for the object.
     */
    SSEKMSKeyId?: SSEKMSKeyId
    /**
     * Indicates whether the multipart upload uses an S3 Bucket Key for server-side encryption with Amazon Web Services KMS (SSE-KMS).
     */
    BucketKeyEnabled?: BucketKeyEnabled
    RequestCharged?: RequestCharged
  }
  export interface CompleteMultipartUploadRequest {
    /**
     * Name of the bucket to which the multipart upload was initiated. When using this action with an access point, you must direct requests to the access point hostname. The access point hostname takes the form AccessPointName-AccountId.s3-accesspoint.Region.amazonaws.com. When using this action with an access point through the Amazon Web Services SDKs, you provide the access point ARN in place of the bucket name. For more information about access point ARNs, see Using access points in the Amazon S3 User Guide. When using this action with Amazon S3 on Outposts, you must direct requests to the S3 on Outposts hostname. The S3 on Outposts hostname takes the form  AccessPointName-AccountId.outpostID.s3-outposts.Region.amazonaws.com. When using this action with S3 on Outposts through the Amazon Web Services SDKs, you provide the Outposts bucket ARN in place of the bucket name. For more information about S3 on Outposts ARNs, see Using Amazon S3 on Outposts in the Amazon S3 User Guide.
     */
    Bucket: BucketName
    /**
     * Object key for which the multipart upload was initiated.
     */
    Key: ObjectKey
    /**
     * The container for the multipart upload request information.
     */
    MultipartUpload?: CompletedMultipartUpload
    /**
     * ID for the initiated multipart upload.
     */
    UploadId: MultipartUploadId
    /**
     * This header can be used as a data integrity check to verify that the data received is the same data that was originally sent. This header specifies the base64-encoded, 32-bit CRC32 checksum of the object. For more information, see Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumCRC32?: ChecksumCRC32
    /**
     * This header can be used as a data integrity check to verify that the data received is the same data that was originally sent. This header specifies the base64-encoded, 32-bit CRC32C checksum of the object. For more information, see Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumCRC32C?: ChecksumCRC32C
    /**
     * This header can be used as a data integrity check to verify that the data received is the same data that was originally sent. This header specifies the base64-encoded, 160-bit SHA-1 digest of the object. For more information, see Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumSHA1?: ChecksumSHA1
    /**
     * This header can be used as a data integrity check to verify that the data received is the same data that was originally sent. This header specifies the base64-encoded, 256-bit SHA-256 digest of the object. For more information, see Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumSHA256?: ChecksumSHA256
    RequestPayer?: RequestPayer
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
    /**
     * The server-side encryption (SSE) algorithm used to encrypt the object. This parameter is needed only when the object was created using a checksum algorithm. For more information, see Protecting data using SSE-C keys in the Amazon S3 User Guide.
     */
    SSECustomerAlgorithm?: SSECustomerAlgorithm
    /**
     * The server-side encryption (SSE) customer managed key. This parameter is needed only when the object was created using a checksum algorithm. For more information, see Protecting data using SSE-C keys in the Amazon S3 User Guide.
     */
    SSECustomerKey?: SSECustomerKey
    /**
     * The MD5 server-side encryption (SSE) customer managed key. This parameter is needed only when the object was created using a checksum algorithm. For more information, see Protecting data using SSE-C keys in the Amazon S3 User Guide.
     */
    SSECustomerKeyMD5?: SSECustomerKeyMD5
  }
  export interface CompletedMultipartUpload {
    /**
     * Array of CompletedPart data types. If you do not supply a valid Part with your request, the service sends back an HTTP 400 response.
     */
    Parts?: CompletedPartList
  }
  export interface CompletedPart {
    /**
     * Entity tag returned when the part was uploaded.
     */
    ETag?: ETag
    /**
     * The base64-encoded, 32-bit CRC32 checksum of the object. This will only be present if it was uploaded with the object. With multipart uploads, this may not be a checksum value of the object. For more information about how checksums are calculated with multipart uploads, see  Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumCRC32?: ChecksumCRC32
    /**
     * The base64-encoded, 32-bit CRC32C checksum of the object. This will only be present if it was uploaded with the object. With multipart uploads, this may not be a checksum value of the object. For more information about how checksums are calculated with multipart uploads, see  Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumCRC32C?: ChecksumCRC32C
    /**
     * The base64-encoded, 160-bit SHA-1 digest of the object. This will only be present if it was uploaded with the object. With multipart uploads, this may not be a checksum value of the object. For more information about how checksums are calculated with multipart uploads, see  Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumSHA1?: ChecksumSHA1
    /**
     * The base64-encoded, 256-bit SHA-256 digest of the object. This will only be present if it was uploaded with the object. With multipart uploads, this may not be a checksum value of the object. For more information about how checksums are calculated with multipart uploads, see  Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumSHA256?: ChecksumSHA256
    /**
     * Part number that identifies the part. This is a positive integer between 1 and 10,000.
     */
    PartNumber?: PartNumber
  }
  export type CompletedPartList = CompletedPart[]
  export type CompressionType = 'NONE' | 'GZIP' | 'BZIP2' | string
  export interface Condition {
    /**
     * The HTTP error code when the redirect is applied. In the event of an error, if the error code equals this value, then the specified redirect is applied. Required when parent element Condition is specified and sibling KeyPrefixEquals is not specified. If both are specified, then both must be true for the redirect to be applied.
     */
    HttpErrorCodeReturnedEquals?: HttpErrorCodeReturnedEquals
    /**
     * The object key name prefix when the redirect is applied. For example, to redirect requests for ExamplePage.html, the key prefix will be ExamplePage.html. To redirect request for all pages with the prefix docs/, the key prefix will be /docs, which identifies all objects in the docs/ folder. Required when the parent element Condition is specified and sibling HttpErrorCodeReturnedEquals is not specified. If both conditions are specified, both must be true for the redirect to be applied.  Replacement must be made for object keys containing special characters (such as carriage returns) when using XML requests. For more information, see  XML related object key constraints.
     */
    KeyPrefixEquals?: KeyPrefixEquals
  }
  export type ConfirmRemoveSelfBucketAccess = boolean
  export type ContentDisposition = string
  export type ContentEncoding = string
  export type ContentLanguage = string
  export type ContentLength = number
  export type ContentMD5 = string
  export type ContentRange = string
  export type ContentType = string
  export interface ContinuationEvent {}
  export interface CopyObjectOutput {
    /**
     * Container for all response elements.
     */
    CopyObjectResult?: CopyObjectResult
    /**
     * If the object expiration is configured, the response includes this header.
     */
    Expiration?: Expiration
    /**
     * Version of the copied object in the destination bucket.
     */
    CopySourceVersionId?: CopySourceVersionId
    /**
     * Version ID of the newly created copy.
     */
    VersionId?: ObjectVersionId
    /**
     * The server-side encryption algorithm used when storing this object in Amazon S3 (for example, AES256, aws:kms).
     */
    ServerSideEncryption?: ServerSideEncryption
    /**
     * If server-side encryption with a customer-provided encryption key was requested, the response will include this header confirming the encryption algorithm used.
     */
    SSECustomerAlgorithm?: SSECustomerAlgorithm
    /**
     * If server-side encryption with a customer-provided encryption key was requested, the response will include this header to provide round-trip message integrity verification of the customer-provided encryption key.
     */
    SSECustomerKeyMD5?: SSECustomerKeyMD5
    /**
     * If present, specifies the ID of the Amazon Web Services Key Management Service (Amazon Web Services KMS) symmetric customer managed key that was used for the object.
     */
    SSEKMSKeyId?: SSEKMSKeyId
    /**
     * If present, specifies the Amazon Web Services KMS Encryption Context to use for object encryption. The value of this header is a base64-encoded UTF-8 string holding JSON with the encryption context key-value pairs.
     */
    SSEKMSEncryptionContext?: SSEKMSEncryptionContext
    /**
     * Indicates whether the copied object uses an S3 Bucket Key for server-side encryption with Amazon Web Services KMS (SSE-KMS).
     */
    BucketKeyEnabled?: BucketKeyEnabled
    RequestCharged?: RequestCharged
  }
  export interface CopyObjectRequest {
    /**
     * The canned ACL to apply to the object. This action is not supported by Amazon S3 on Outposts.
     */
    ACL?: ObjectCannedACL
    /**
     * The name of the destination bucket. When using this action with an access point, you must direct requests to the access point hostname. The access point hostname takes the form AccessPointName-AccountId.s3-accesspoint.Region.amazonaws.com. When using this action with an access point through the Amazon Web Services SDKs, you provide the access point ARN in place of the bucket name. For more information about access point ARNs, see Using access points in the Amazon S3 User Guide. When using this action with Amazon S3 on Outposts, you must direct requests to the S3 on Outposts hostname. The S3 on Outposts hostname takes the form  AccessPointName-AccountId.outpostID.s3-outposts.Region.amazonaws.com. When using this action with S3 on Outposts through the Amazon Web Services SDKs, you provide the Outposts bucket ARN in place of the bucket name. For more information about S3 on Outposts ARNs, see Using Amazon S3 on Outposts in the Amazon S3 User Guide.
     */
    Bucket: BucketName
    /**
     * Specifies caching behavior along the request/reply chain.
     */
    CacheControl?: CacheControl
    /**
     * Indicates the algorithm you want Amazon S3 to use to create the checksum for the object. For more information, see Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumAlgorithm?: ChecksumAlgorithm
    /**
     * Specifies presentational information for the object.
     */
    ContentDisposition?: ContentDisposition
    /**
     * Specifies what content encodings have been applied to the object and thus what decoding mechanisms must be applied to obtain the media-type referenced by the Content-Type header field.
     */
    ContentEncoding?: ContentEncoding
    /**
     * The language the content is in.
     */
    ContentLanguage?: ContentLanguage
    /**
     * A standard MIME type describing the format of the object data.
     */
    ContentType?: ContentType
    /**
     * Specifies the source object for the copy operation. You specify the value in one of two formats, depending on whether you want to access the source object through an access point:   For objects not accessed through an access point, specify the name of the source bucket and the key of the source object, separated by a slash (/). For example, to copy the object reports/january.pdf from the bucket awsexamplebucket, use awsexamplebucket/reports/january.pdf. The value must be URL-encoded.   For objects accessed through access points, specify the Amazon Resource Name (ARN) of the object as accessed through the access point, in the format arn:aws:s3:&lt;Region&gt;:&lt;account-id&gt;:accesspoint/&lt;access-point-name&gt;/object/&lt;key&gt;. For example, to copy the object reports/january.pdf through access point my-access-point owned by account 123456789012 in Region us-west-2, use the URL encoding of arn:aws:s3:us-west-2:123456789012:accesspoint/my-access-point/object/reports/january.pdf. The value must be URL encoded.  Amazon S3 supports copy operations using access points only when the source and destination buckets are in the same Amazon Web Services Region.  Alternatively, for objects accessed through Amazon S3 on Outposts, specify the ARN of the object as accessed in the format arn:aws:s3-outposts:&lt;Region&gt;:&lt;account-id&gt;:outpost/&lt;outpost-id&gt;/object/&lt;key&gt;. For example, to copy the object reports/january.pdf through outpost my-outpost owned by account 123456789012 in Region us-west-2, use the URL encoding of arn:aws:s3-outposts:us-west-2:123456789012:outpost/my-outpost/object/reports/january.pdf. The value must be URL-encoded.    To copy a specific version of an object, append ?versionId=&lt;version-id&gt; to the value (for example, awsexamplebucket/reports/january.pdf?versionId=QUpfdndhfd8438MNFDN93jdnJFkdmqnh893). If you don't specify a version ID, Amazon S3 copies the latest version of the source object.
     */
    CopySource: CopySource
    /**
     * Copies the object if its entity tag (ETag) matches the specified tag.
     */
    CopySourceIfMatch?: CopySourceIfMatch
    /**
     * Copies the object if it has been modified since the specified time.
     */
    CopySourceIfModifiedSince?: CopySourceIfModifiedSince
    /**
     * Copies the object if its entity tag (ETag) is different than the specified ETag.
     */
    CopySourceIfNoneMatch?: CopySourceIfNoneMatch
    /**
     * Copies the object if it hasn't been modified since the specified time.
     */
    CopySourceIfUnmodifiedSince?: CopySourceIfUnmodifiedSince
    /**
     * The date and time at which the object is no longer cacheable.
     */
    Expires?: Expires
    /**
     * Gives the grantee READ, READ_ACP, and WRITE_ACP permissions on the object. This action is not supported by Amazon S3 on Outposts.
     */
    GrantFullControl?: GrantFullControl
    /**
     * Allows grantee to read the object data and its metadata. This action is not supported by Amazon S3 on Outposts.
     */
    GrantRead?: GrantRead
    /**
     * Allows grantee to read the object ACL. This action is not supported by Amazon S3 on Outposts.
     */
    GrantReadACP?: GrantReadACP
    /**
     * Allows grantee to write the ACL for the applicable object. This action is not supported by Amazon S3 on Outposts.
     */
    GrantWriteACP?: GrantWriteACP
    /**
     * The key of the destination object.
     */
    Key: ObjectKey
    /**
     * A map of metadata to store with the object in S3.
     */
    Metadata?: Metadata
    /**
     * Specifies whether the metadata is copied from the source object or replaced with metadata provided in the request.
     */
    MetadataDirective?: MetadataDirective
    /**
     * Specifies whether the object tag-set are copied from the source object or replaced with tag-set provided in the request.
     */
    TaggingDirective?: TaggingDirective
    /**
     * The server-side encryption algorithm used when storing this object in Amazon S3 (for example, AES256, aws:kms).
     */
    ServerSideEncryption?: ServerSideEncryption
    /**
     * By default, Amazon S3 uses the STANDARD Storage Class to store newly created objects. The STANDARD storage class provides high durability and high availability. Depending on performance needs, you can specify a different Storage Class. Amazon S3 on Outposts only uses the OUTPOSTS Storage Class. For more information, see Storage Classes in the Amazon S3 User Guide.
     */
    StorageClass?: StorageClass
    /**
     * If the bucket is configured as a website, redirects requests for this object to another object in the same bucket or to an external URL. Amazon S3 stores the value of this header in the object metadata.
     */
    WebsiteRedirectLocation?: WebsiteRedirectLocation
    /**
     * Specifies the algorithm to use to when encrypting the object (for example, AES256).
     */
    SSECustomerAlgorithm?: SSECustomerAlgorithm
    /**
     * Specifies the customer-provided encryption key for Amazon S3 to use in encrypting data. This value is used to store the object and then it is discarded; Amazon S3 does not store the encryption key. The key must be appropriate for use with the algorithm specified in the x-amz-server-side-encryption-customer-algorithm header.
     */
    SSECustomerKey?: SSECustomerKey
    /**
     * Specifies the 128-bit MD5 digest of the encryption key according to RFC 1321. Amazon S3 uses this header for a message integrity check to ensure that the encryption key was transmitted without error.
     */
    SSECustomerKeyMD5?: SSECustomerKeyMD5
    /**
     * Specifies the Amazon Web Services KMS key ID to use for object encryption. All GET and PUT requests for an object protected by Amazon Web Services KMS will fail if not made via SSL or using SigV4. For information about configuring using any of the officially supported Amazon Web Services SDKs and Amazon Web Services CLI, see Specifying the Signature Version in Request Authentication in the Amazon S3 User Guide.
     */
    SSEKMSKeyId?: SSEKMSKeyId
    /**
     * Specifies the Amazon Web Services KMS Encryption Context to use for object encryption. The value of this header is a base64-encoded UTF-8 string holding JSON with the encryption context key-value pairs.
     */
    SSEKMSEncryptionContext?: SSEKMSEncryptionContext
    /**
     * Specifies whether Amazon S3 should use an S3 Bucket Key for object encryption with server-side encryption using AWS KMS (SSE-KMS). Setting this header to true causes Amazon S3 to use an S3 Bucket Key for object encryption with SSE-KMS.  Specifying this header with a COPY action doesn’t affect bucket-level settings for S3 Bucket Key.
     */
    BucketKeyEnabled?: BucketKeyEnabled
    /**
     * Specifies the algorithm to use when decrypting the source object (for example, AES256).
     */
    CopySourceSSECustomerAlgorithm?: CopySourceSSECustomerAlgorithm
    /**
     * Specifies the customer-provided encryption key for Amazon S3 to use to decrypt the source object. The encryption key provided in this header must be one that was used when the source object was created.
     */
    CopySourceSSECustomerKey?: CopySourceSSECustomerKey
    /**
     * Specifies the 128-bit MD5 digest of the encryption key according to RFC 1321. Amazon S3 uses this header for a message integrity check to ensure that the encryption key was transmitted without error.
     */
    CopySourceSSECustomerKeyMD5?: CopySourceSSECustomerKeyMD5
    RequestPayer?: RequestPayer
    /**
     * The tag-set for the object destination object this value must be used in conjunction with the TaggingDirective. The tag-set must be encoded as URL Query parameters.
     */
    Tagging?: TaggingHeader
    /**
     * The Object Lock mode that you want to apply to the copied object.
     */
    ObjectLockMode?: ObjectLockMode
    /**
     * The date and time when you want the copied object's Object Lock to expire.
     */
    ObjectLockRetainUntilDate?: ObjectLockRetainUntilDate
    /**
     * Specifies whether you want to apply a legal hold to the copied object.
     */
    ObjectLockLegalHoldStatus?: ObjectLockLegalHoldStatus
    /**
     * The account ID of the expected destination bucket owner. If the destination bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
    /**
     * The account ID of the expected source bucket owner. If the source bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedSourceBucketOwner?: AccountId
  }
  export interface CopyObjectResult {
    /**
     * Returns the ETag of the new object. The ETag reflects only changes to the contents of an object, not its metadata.
     */
    ETag?: ETag
    /**
     * Creation date of the object.
     */
    LastModified?: LastModified
    /**
     * The base64-encoded, 32-bit CRC32 checksum of the object. This will only be present if it was uploaded with the object. With multipart uploads, this may not be a checksum value of the object. For more information about how checksums are calculated with multipart uploads, see  Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumCRC32?: ChecksumCRC32
    /**
     * The base64-encoded, 32-bit CRC32C checksum of the object. This will only be present if it was uploaded with the object. With multipart uploads, this may not be a checksum value of the object. For more information about how checksums are calculated with multipart uploads, see  Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumCRC32C?: ChecksumCRC32C
    /**
     * The base64-encoded, 160-bit SHA-1 digest of the object. This will only be present if it was uploaded with the object. With multipart uploads, this may not be a checksum value of the object. For more information about how checksums are calculated with multipart uploads, see  Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumSHA1?: ChecksumSHA1
    /**
     * The base64-encoded, 256-bit SHA-256 digest of the object. This will only be present if it was uploaded with the object. With multipart uploads, this may not be a checksum value of the object. For more information about how checksums are calculated with multipart uploads, see  Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumSHA256?: ChecksumSHA256
  }
  export interface CopyPartResult {
    /**
     * Entity tag of the object.
     */
    ETag?: ETag
    /**
     * Date and time at which the object was uploaded.
     */
    LastModified?: LastModified
    /**
     * The base64-encoded, 32-bit CRC32 checksum of the object. This will only be present if it was uploaded with the object. With multipart uploads, this may not be a checksum value of the object. For more information about how checksums are calculated with multipart uploads, see  Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumCRC32?: ChecksumCRC32
    /**
     * The base64-encoded, 32-bit CRC32C checksum of the object. This will only be present if it was uploaded with the object. With multipart uploads, this may not be a checksum value of the object. For more information about how checksums are calculated with multipart uploads, see  Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumCRC32C?: ChecksumCRC32C
    /**
     * The base64-encoded, 160-bit SHA-1 digest of the object. This will only be present if it was uploaded with the object. With multipart uploads, this may not be a checksum value of the object. For more information about how checksums are calculated with multipart uploads, see  Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumSHA1?: ChecksumSHA1
    /**
     * The base64-encoded, 256-bit SHA-256 digest of the object. This will only be present if it was uploaded with the object. With multipart uploads, this may not be a checksum value of the object. For more information about how checksums are calculated with multipart uploads, see  Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumSHA256?: ChecksumSHA256
  }
  export type CopySource = string
  export type CopySourceIfMatch = string
  export type CopySourceIfModifiedSince = Date
  export type CopySourceIfNoneMatch = string
  export type CopySourceIfUnmodifiedSince = Date
  export type CopySourceRange = string
  export type CopySourceSSECustomerAlgorithm = string
  export type CopySourceSSECustomerKey = Buffer | Uint8Array | Blob | string
  export type CopySourceSSECustomerKeyMD5 = string
  export type CopySourceVersionId = string
  export interface CreateBucketConfiguration {
    /**
     * Specifies the Region where the bucket will be created. If you don't specify a Region, the bucket is created in the US East (N. Virginia) Region (us-east-1).
     */
    LocationConstraint?: BucketLocationConstraint
  }
  export interface CreateBucketOutput {
    /**
     * A forward slash followed by the name of the bucket.
     */
    Location?: Location
  }
  export interface CreateBucketRequest {
    /**
     * The canned ACL to apply to the bucket.
     */
    ACL?: BucketCannedACL
    /**
     * The name of the bucket to create.
     */
    Bucket: BucketName
    /**
     * The configuration information for the bucket.
     */
    CreateBucketConfiguration?: CreateBucketConfiguration
    /**
     * Allows grantee the read, write, read ACP, and write ACP permissions on the bucket.
     */
    GrantFullControl?: GrantFullControl
    /**
     * Allows grantee to list the objects in the bucket.
     */
    GrantRead?: GrantRead
    /**
     * Allows grantee to read the bucket ACL.
     */
    GrantReadACP?: GrantReadACP
    /**
     * Allows grantee to create new objects in the bucket. For the bucket and object owners of existing objects, also allows deletions and overwrites of those objects.
     */
    GrantWrite?: GrantWrite
    /**
     * Allows grantee to write the ACL for the applicable bucket.
     */
    GrantWriteACP?: GrantWriteACP
    /**
     * Specifies whether you want S3 Object Lock to be enabled for the new bucket.
     */
    ObjectLockEnabledForBucket?: ObjectLockEnabledForBucket
    ObjectOwnership?: ObjectOwnership
  }
  export interface CreateMultipartUploadOutput {
    /**
     * If the bucket has a lifecycle rule configured with an action to abort incomplete multipart uploads and the prefix in the lifecycle rule matches the object name in the request, the response includes this header. The header indicates when the initiated multipart upload becomes eligible for an abort operation. For more information, see  Aborting Incomplete Multipart Uploads Using a Bucket Lifecycle Policy. The response also includes the x-amz-abort-rule-id header that provides the ID of the lifecycle configuration rule that defines this action.
     */
    AbortDate?: AbortDate
    /**
     * This header is returned along with the x-amz-abort-date header. It identifies the applicable lifecycle configuration rule that defines the action to abort incomplete multipart uploads.
     */
    AbortRuleId?: AbortRuleId
    /**
     * The name of the bucket to which the multipart upload was initiated. Does not return the access point ARN or access point alias if used. When using this action with an access point, you must direct requests to the access point hostname. The access point hostname takes the form AccessPointName-AccountId.s3-accesspoint.Region.amazonaws.com. When using this action with an access point through the Amazon Web Services SDKs, you provide the access point ARN in place of the bucket name. For more information about access point ARNs, see Using access points in the Amazon S3 User Guide. When using this action with Amazon S3 on Outposts, you must direct requests to the S3 on Outposts hostname. The S3 on Outposts hostname takes the form  AccessPointName-AccountId.outpostID.s3-outposts.Region.amazonaws.com. When using this action with S3 on Outposts through the Amazon Web Services SDKs, you provide the Outposts bucket ARN in place of the bucket name. For more information about S3 on Outposts ARNs, see Using Amazon S3 on Outposts in the Amazon S3 User Guide.
     */
    Bucket?: BucketName
    /**
     * Object key for which the multipart upload was initiated.
     */
    Key?: ObjectKey
    /**
     * ID for the initiated multipart upload.
     */
    UploadId?: MultipartUploadId
    /**
     * The server-side encryption algorithm used when storing this object in Amazon S3 (for example, AES256, aws:kms).
     */
    ServerSideEncryption?: ServerSideEncryption
    /**
     * If server-side encryption with a customer-provided encryption key was requested, the response will include this header confirming the encryption algorithm used.
     */
    SSECustomerAlgorithm?: SSECustomerAlgorithm
    /**
     * If server-side encryption with a customer-provided encryption key was requested, the response will include this header to provide round-trip message integrity verification of the customer-provided encryption key.
     */
    SSECustomerKeyMD5?: SSECustomerKeyMD5
    /**
     * If present, specifies the ID of the Amazon Web Services Key Management Service (Amazon Web Services KMS) symmetric customer managed key that was used for the object.
     */
    SSEKMSKeyId?: SSEKMSKeyId
    /**
     * If present, specifies the Amazon Web Services KMS Encryption Context to use for object encryption. The value of this header is a base64-encoded UTF-8 string holding JSON with the encryption context key-value pairs.
     */
    SSEKMSEncryptionContext?: SSEKMSEncryptionContext
    /**
     * Indicates whether the multipart upload uses an S3 Bucket Key for server-side encryption with Amazon Web Services KMS (SSE-KMS).
     */
    BucketKeyEnabled?: BucketKeyEnabled
    RequestCharged?: RequestCharged
    /**
     * The algorithm that was used to create a checksum of the object.
     */
    ChecksumAlgorithm?: ChecksumAlgorithm
  }
  export interface CreateMultipartUploadRequest {
    /**
     * The canned ACL to apply to the object. This action is not supported by Amazon S3 on Outposts.
     */
    ACL?: ObjectCannedACL
    /**
     * The name of the bucket to which to initiate the upload When using this action with an access point, you must direct requests to the access point hostname. The access point hostname takes the form AccessPointName-AccountId.s3-accesspoint.Region.amazonaws.com. When using this action with an access point through the Amazon Web Services SDKs, you provide the access point ARN in place of the bucket name. For more information about access point ARNs, see Using access points in the Amazon S3 User Guide. When using this action with Amazon S3 on Outposts, you must direct requests to the S3 on Outposts hostname. The S3 on Outposts hostname takes the form  AccessPointName-AccountId.outpostID.s3-outposts.Region.amazonaws.com. When using this action with S3 on Outposts through the Amazon Web Services SDKs, you provide the Outposts bucket ARN in place of the bucket name. For more information about S3 on Outposts ARNs, see Using Amazon S3 on Outposts in the Amazon S3 User Guide.
     */
    Bucket: BucketName
    /**
     * Specifies caching behavior along the request/reply chain.
     */
    CacheControl?: CacheControl
    /**
     * Specifies presentational information for the object.
     */
    ContentDisposition?: ContentDisposition
    /**
     * Specifies what content encodings have been applied to the object and thus what decoding mechanisms must be applied to obtain the media-type referenced by the Content-Type header field.
     */
    ContentEncoding?: ContentEncoding
    /**
     * The language the content is in.
     */
    ContentLanguage?: ContentLanguage
    /**
     * A standard MIME type describing the format of the object data.
     */
    ContentType?: ContentType
    /**
     * The date and time at which the object is no longer cacheable.
     */
    Expires?: Expires
    /**
     * Gives the grantee READ, READ_ACP, and WRITE_ACP permissions on the object. This action is not supported by Amazon S3 on Outposts.
     */
    GrantFullControl?: GrantFullControl
    /**
     * Allows grantee to read the object data and its metadata. This action is not supported by Amazon S3 on Outposts.
     */
    GrantRead?: GrantRead
    /**
     * Allows grantee to read the object ACL. This action is not supported by Amazon S3 on Outposts.
     */
    GrantReadACP?: GrantReadACP
    /**
     * Allows grantee to write the ACL for the applicable object. This action is not supported by Amazon S3 on Outposts.
     */
    GrantWriteACP?: GrantWriteACP
    /**
     * Object key for which the multipart upload is to be initiated.
     */
    Key: ObjectKey
    /**
     * A map of metadata to store with the object in S3.
     */
    Metadata?: Metadata
    /**
     * The server-side encryption algorithm used when storing this object in Amazon S3 (for example, AES256, aws:kms).
     */
    ServerSideEncryption?: ServerSideEncryption
    /**
     * By default, Amazon S3 uses the STANDARD Storage Class to store newly created objects. The STANDARD storage class provides high durability and high availability. Depending on performance needs, you can specify a different Storage Class. Amazon S3 on Outposts only uses the OUTPOSTS Storage Class. For more information, see Storage Classes in the Amazon S3 User Guide.
     */
    StorageClass?: StorageClass
    /**
     * If the bucket is configured as a website, redirects requests for this object to another object in the same bucket or to an external URL. Amazon S3 stores the value of this header in the object metadata.
     */
    WebsiteRedirectLocation?: WebsiteRedirectLocation
    /**
     * Specifies the algorithm to use to when encrypting the object (for example, AES256).
     */
    SSECustomerAlgorithm?: SSECustomerAlgorithm
    /**
     * Specifies the customer-provided encryption key for Amazon S3 to use in encrypting data. This value is used to store the object and then it is discarded; Amazon S3 does not store the encryption key. The key must be appropriate for use with the algorithm specified in the x-amz-server-side-encryption-customer-algorithm header.
     */
    SSECustomerKey?: SSECustomerKey
    /**
     * Specifies the 128-bit MD5 digest of the encryption key according to RFC 1321. Amazon S3 uses this header for a message integrity check to ensure that the encryption key was transmitted without error.
     */
    SSECustomerKeyMD5?: SSECustomerKeyMD5
    /**
     * Specifies the ID of the symmetric customer managed key to use for object encryption. All GET and PUT requests for an object protected by Amazon Web Services KMS will fail if not made via SSL or using SigV4. For information about configuring using any of the officially supported Amazon Web Services SDKs and Amazon Web Services CLI, see Specifying the Signature Version in Request Authentication in the Amazon S3 User Guide.
     */
    SSEKMSKeyId?: SSEKMSKeyId
    /**
     * Specifies the Amazon Web Services KMS Encryption Context to use for object encryption. The value of this header is a base64-encoded UTF-8 string holding JSON with the encryption context key-value pairs.
     */
    SSEKMSEncryptionContext?: SSEKMSEncryptionContext
    /**
     * Specifies whether Amazon S3 should use an S3 Bucket Key for object encryption with server-side encryption using AWS KMS (SSE-KMS). Setting this header to true causes Amazon S3 to use an S3 Bucket Key for object encryption with SSE-KMS. Specifying this header with an object action doesn’t affect bucket-level settings for S3 Bucket Key.
     */
    BucketKeyEnabled?: BucketKeyEnabled
    RequestPayer?: RequestPayer
    /**
     * The tag-set for the object. The tag-set must be encoded as URL Query parameters.
     */
    Tagging?: TaggingHeader
    /**
     * Specifies the Object Lock mode that you want to apply to the uploaded object.
     */
    ObjectLockMode?: ObjectLockMode
    /**
     * Specifies the date and time when you want the Object Lock to expire.
     */
    ObjectLockRetainUntilDate?: ObjectLockRetainUntilDate
    /**
     * Specifies whether you want to apply a legal hold to the uploaded object.
     */
    ObjectLockLegalHoldStatus?: ObjectLockLegalHoldStatus
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
    /**
     * Indicates the algorithm you want Amazon S3 to use to create the checksum for the object. For more information, see Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumAlgorithm?: ChecksumAlgorithm
  }
  export type CreationDate = Date
  export type _Date = Date
  export type Days = number
  export type DaysAfterInitiation = number
  export interface DefaultRetention {
    /**
     * The default Object Lock retention mode you want to apply to new objects placed in the specified bucket. Must be used with either Days or Years.
     */
    Mode?: ObjectLockRetentionMode
    /**
     * The number of days that you want to specify for the default retention period. Must be used with Mode.
     */
    Days?: Days
    /**
     * The number of years that you want to specify for the default retention period. Must be used with Mode.
     */
    Years?: Years
  }
  export interface Delete {
    /**
     * The objects to delete.
     */
    Objects: ObjectIdentifierList
    /**
     * Element to enable quiet mode for the request. When you add this element, you must set its value to true.
     */
    Quiet?: Quiet
  }
  export interface DeleteBucketAnalyticsConfigurationRequest {
    /**
     * The name of the bucket from which an analytics configuration is deleted.
     */
    Bucket: BucketName
    /**
     * The ID that identifies the analytics configuration.
     */
    Id: AnalyticsId
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface DeleteBucketCorsRequest {
    /**
     * Specifies the bucket whose cors configuration is being deleted.
     */
    Bucket: BucketName
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface DeleteBucketEncryptionRequest {
    /**
     * The name of the bucket containing the server-side encryption configuration to delete.
     */
    Bucket: BucketName
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface DeleteBucketIntelligentTieringConfigurationRequest {
    /**
     * The name of the Amazon S3 bucket whose configuration you want to modify or retrieve.
     */
    Bucket: BucketName
    /**
     * The ID used to identify the S3 Intelligent-Tiering configuration.
     */
    Id: IntelligentTieringId
  }
  export interface DeleteBucketInventoryConfigurationRequest {
    /**
     * The name of the bucket containing the inventory configuration to delete.
     */
    Bucket: BucketName
    /**
     * The ID used to identify the inventory configuration.
     */
    Id: InventoryId
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface DeleteBucketLifecycleRequest {
    /**
     * The bucket name of the lifecycle to delete.
     */
    Bucket: BucketName
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface DeleteBucketMetricsConfigurationRequest {
    /**
     * The name of the bucket containing the metrics configuration to delete.
     */
    Bucket: BucketName
    /**
     * The ID used to identify the metrics configuration.
     */
    Id: MetricsId
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface DeleteBucketOwnershipControlsRequest {
    /**
     * The Amazon S3 bucket whose OwnershipControls you want to delete.
     */
    Bucket: BucketName
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface DeleteBucketPolicyRequest {
    /**
     * The bucket name.
     */
    Bucket: BucketName
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface DeleteBucketReplicationRequest {
    /**
     *  The bucket name.
     */
    Bucket: BucketName
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface DeleteBucketRequest {
    /**
     * Specifies the bucket being deleted.
     */
    Bucket: BucketName
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface DeleteBucketTaggingRequest {
    /**
     * The bucket that has the tag set to be removed.
     */
    Bucket: BucketName
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface DeleteBucketWebsiteRequest {
    /**
     * The bucket name for which you want to remove the website configuration.
     */
    Bucket: BucketName
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export type DeleteMarker = boolean
  export interface DeleteMarkerEntry {
    /**
     * The account that created the delete marker.&gt;
     */
    Owner?: Owner
    /**
     * The object key.
     */
    Key?: ObjectKey
    /**
     * Version ID of an object.
     */
    VersionId?: ObjectVersionId
    /**
     * Specifies whether the object is (true) or is not (false) the latest version of an object.
     */
    IsLatest?: IsLatest
    /**
     * Date and time the object was last modified.
     */
    LastModified?: LastModified
  }
  export interface DeleteMarkerReplication {
    /**
     * Indicates whether to replicate delete markers.  Indicates whether to replicate delete markers.
     */
    Status?: DeleteMarkerReplicationStatus
  }
  export type DeleteMarkerReplicationStatus = 'Enabled' | 'Disabled' | string
  export type DeleteMarkerVersionId = string
  export type DeleteMarkers = DeleteMarkerEntry[]
  export interface DeleteObjectOutput {
    /**
     * Specifies whether the versioned object that was permanently deleted was (true) or was not (false) a delete marker.
     */
    DeleteMarker?: DeleteMarker
    /**
     * Returns the version ID of the delete marker created as a result of the DELETE operation.
     */
    VersionId?: ObjectVersionId
    RequestCharged?: RequestCharged
  }
  export interface DeleteObjectRequest {
    /**
     * The bucket name of the bucket containing the object.  When using this action with an access point, you must direct requests to the access point hostname. The access point hostname takes the form AccessPointName-AccountId.s3-accesspoint.Region.amazonaws.com. When using this action with an access point through the Amazon Web Services SDKs, you provide the access point ARN in place of the bucket name. For more information about access point ARNs, see Using access points in the Amazon S3 User Guide. When using this action with Amazon S3 on Outposts, you must direct requests to the S3 on Outposts hostname. The S3 on Outposts hostname takes the form  AccessPointName-AccountId.outpostID.s3-outposts.Region.amazonaws.com. When using this action with S3 on Outposts through the Amazon Web Services SDKs, you provide the Outposts bucket ARN in place of the bucket name. For more information about S3 on Outposts ARNs, see Using Amazon S3 on Outposts in the Amazon S3 User Guide.
     */
    Bucket: BucketName
    /**
     * Key name of the object to delete.
     */
    Key: ObjectKey
    /**
     * The concatenation of the authentication device's serial number, a space, and the value that is displayed on your authentication device. Required to permanently delete a versioned object if versioning is configured with MFA delete enabled.
     */
    MFA?: MFA
    /**
     * VersionId used to reference a specific version of the object.
     */
    VersionId?: ObjectVersionId
    RequestPayer?: RequestPayer
    /**
     * Indicates whether S3 Object Lock should bypass Governance-mode restrictions to process this operation. To use this header, you must have the s3:BypassGovernanceRetention permission.
     */
    BypassGovernanceRetention?: BypassGovernanceRetention
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface DeleteObjectTaggingOutput {
    /**
     * The versionId of the object the tag-set was removed from.
     */
    VersionId?: ObjectVersionId
  }
  export interface DeleteObjectTaggingRequest {
    /**
     * The bucket name containing the objects from which to remove the tags.  When using this action with an access point, you must direct requests to the access point hostname. The access point hostname takes the form AccessPointName-AccountId.s3-accesspoint.Region.amazonaws.com. When using this action with an access point through the Amazon Web Services SDKs, you provide the access point ARN in place of the bucket name. For more information about access point ARNs, see Using access points in the Amazon S3 User Guide. When using this action with Amazon S3 on Outposts, you must direct requests to the S3 on Outposts hostname. The S3 on Outposts hostname takes the form  AccessPointName-AccountId.outpostID.s3-outposts.Region.amazonaws.com. When using this action with S3 on Outposts through the Amazon Web Services SDKs, you provide the Outposts bucket ARN in place of the bucket name. For more information about S3 on Outposts ARNs, see Using Amazon S3 on Outposts in the Amazon S3 User Guide.
     */
    Bucket: BucketName
    /**
     * The key that identifies the object in the bucket from which to remove all tags.
     */
    Key: ObjectKey
    /**
     * The versionId of the object that the tag-set will be removed from.
     */
    VersionId?: ObjectVersionId
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface DeleteObjectsOutput {
    /**
     * Container element for a successful delete. It identifies the object that was successfully deleted.
     */
    Deleted?: DeletedObjects
    RequestCharged?: RequestCharged
    /**
     * Container for a failed delete action that describes the object that Amazon S3 attempted to delete and the error it encountered.
     */
    Errors?: Errors
  }
  export interface DeleteObjectsRequest {
    /**
     * The bucket name containing the objects to delete.  When using this action with an access point, you must direct requests to the access point hostname. The access point hostname takes the form AccessPointName-AccountId.s3-accesspoint.Region.amazonaws.com. When using this action with an access point through the Amazon Web Services SDKs, you provide the access point ARN in place of the bucket name. For more information about access point ARNs, see Using access points in the Amazon S3 User Guide. When using this action with Amazon S3 on Outposts, you must direct requests to the S3 on Outposts hostname. The S3 on Outposts hostname takes the form  AccessPointName-AccountId.outpostID.s3-outposts.Region.amazonaws.com. When using this action with S3 on Outposts through the Amazon Web Services SDKs, you provide the Outposts bucket ARN in place of the bucket name. For more information about S3 on Outposts ARNs, see Using Amazon S3 on Outposts in the Amazon S3 User Guide.
     */
    Bucket: BucketName
    /**
     * Container for the request.
     */
    Delete: Delete
    /**
     * The concatenation of the authentication device's serial number, a space, and the value that is displayed on your authentication device. Required to permanently delete a versioned object if versioning is configured with MFA delete enabled.
     */
    MFA?: MFA
    RequestPayer?: RequestPayer
    /**
     * Specifies whether you want to delete this object even if it has a Governance-type Object Lock in place. To use this header, you must have the s3:BypassGovernanceRetention permission.
     */
    BypassGovernanceRetention?: BypassGovernanceRetention
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
    /**
     * Indicates the algorithm used to create the checksum for the object when using the SDK. This header will not provide any additional functionality if not using the SDK. When sending this header, there must be a corresponding x-amz-checksum or x-amz-trailer header sent. Otherwise, Amazon S3 fails the request with the HTTP status code 400 Bad Request. For more information, see Checking object integrity in the Amazon S3 User Guide. If you provide an individual checksum, Amazon S3 ignores any provided ChecksumAlgorithm parameter. This checksum algorithm must be the same for all parts and it match the checksum value supplied in the CreateMultipartUpload request.
     */
    ChecksumAlgorithm?: ChecksumAlgorithm
  }
  export interface DeletePublicAccessBlockRequest {
    /**
     * The Amazon S3 bucket whose PublicAccessBlock configuration you want to delete.
     */
    Bucket: BucketName
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface DeletedObject {
    /**
     * The name of the deleted object.
     */
    Key?: ObjectKey
    /**
     * The version ID of the deleted object.
     */
    VersionId?: ObjectVersionId
    /**
     * Specifies whether the versioned object that was permanently deleted was (true) or was not (false) a delete marker. In a simple DELETE, this header indicates whether (true) or not (false) a delete marker was created.
     */
    DeleteMarker?: DeleteMarker
    /**
     * The version ID of the delete marker created as a result of the DELETE operation. If you delete a specific object version, the value returned by this header is the version ID of the object version deleted.
     */
    DeleteMarkerVersionId?: DeleteMarkerVersionId
  }
  export type DeletedObjects = DeletedObject[]
  export type Delimiter = string
  export type Description = string
  export interface Destination {
    /**
     *  The Amazon Resource Name (ARN) of the bucket where you want Amazon S3 to store the results.
     */
    Bucket: BucketName
    /**
     * Destination bucket owner account ID. In a cross-account scenario, if you direct Amazon S3 to change replica ownership to the Amazon Web Services account that owns the destination bucket by specifying the AccessControlTranslation property, this is the account ID of the destination bucket owner. For more information, see Replication Additional Configuration: Changing the Replica Owner in the Amazon S3 User Guide.
     */
    Account?: AccountId
    /**
     *  The storage class to use when replicating objects, such as S3 Standard or reduced redundancy. By default, Amazon S3 uses the storage class of the source object to create the object replica.  For valid values, see the StorageClass element of the PUT Bucket replication action in the Amazon S3 API Reference.
     */
    StorageClass?: StorageClass
    /**
     * Specify this only in a cross-account scenario (where source and destination bucket owners are not the same), and you want to change replica ownership to the Amazon Web Services account that owns the destination bucket. If this is not specified in the replication configuration, the replicas are owned by same Amazon Web Services account that owns the source object.
     */
    AccessControlTranslation?: AccessControlTranslation
    /**
     * A container that provides information about encryption. If SourceSelectionCriteria is specified, you must specify this element.
     */
    EncryptionConfiguration?: EncryptionConfiguration
    /**
     *  A container specifying S3 Replication Time Control (S3 RTC), including whether S3 RTC is enabled and the time when all objects and operations on objects must be replicated. Must be specified together with a Metrics block.
     */
    ReplicationTime?: ReplicationTime
    /**
     *  A container specifying replication metrics-related settings enabling replication metrics and events.
     */
    Metrics?: Metrics
  }
  export type DisplayName = string
  export type ETag = string
  export type EmailAddress = string
  export type EnableRequestProgress = boolean
  export type EncodingType = 'url' | string
  export interface Encryption {
    /**
     * The server-side encryption algorithm used when storing job results in Amazon S3 (for example, AES256, aws:kms).
     */
    EncryptionType: ServerSideEncryption
    /**
     * If the encryption type is aws:kms, this optional value specifies the ID of the symmetric customer managed key to use for encryption of job results. Amazon S3 only supports symmetric keys. For more information, see Using symmetric and asymmetric keys in the Amazon Web Services Key Management Service Developer Guide.
     */
    KMSKeyId?: SSEKMSKeyId
    /**
     * If the encryption type is aws:kms, this optional value can be used to specify the encryption context for the restore results.
     */
    KMSContext?: KMSContext
  }
  export interface EncryptionConfiguration {
    /**
     * Specifies the ID (Key ARN or Alias ARN) of the customer managed Amazon Web Services KMS key stored in Amazon Web Services Key Management Service (KMS) for the destination bucket. Amazon S3 uses this key to encrypt replica objects. Amazon S3 only supports symmetric, customer managed KMS keys. For more information, see Using symmetric and asymmetric keys in the Amazon Web Services Key Management Service Developer Guide.
     */
    ReplicaKmsKeyID?: ReplicaKmsKeyID
  }
  export type End = number
  export interface EndEvent {}
  export interface Error {
    /**
     * The error key.
     */
    Key?: ObjectKey
    /**
     * The version ID of the error.
     */
    VersionId?: ObjectVersionId
    /**
     * The error code is a string that uniquely identifies an error condition. It is meant to be read and understood by programs that detect and handle errors by type.   Amazon S3 error codes       Code: AccessDenied     Description: Access Denied    HTTP Status Code: 403 Forbidden    SOAP Fault Code Prefix: Client        Code: AccountProblem    Description: There is a problem with your Amazon Web Services account that prevents the action from completing successfully. Contact Amazon Web Services Support for further assistance.    HTTP Status Code: 403 Forbidden    SOAP Fault Code Prefix: Client        Code: AllAccessDisabled    Description: All access to this Amazon S3 resource has been disabled. Contact Amazon Web Services Support for further assistance.    HTTP Status Code: 403 Forbidden    SOAP Fault Code Prefix: Client        Code: AmbiguousGrantByEmailAddress    Description: The email address you provided is associated with more than one account.    HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: AuthorizationHeaderMalformed    Description: The authorization header you provided is invalid.    HTTP Status Code: 400 Bad Request    HTTP Status Code: N/A        Code: BadDigest    Description: The Content-MD5 you specified did not match what we received.    HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: BucketAlreadyExists    Description: The requested bucket name is not available. The bucket namespace is shared by all users of the system. Please select a different name and try again.    HTTP Status Code: 409 Conflict    SOAP Fault Code Prefix: Client        Code: BucketAlreadyOwnedByYou    Description: The bucket you tried to create already exists, and you own it. Amazon S3 returns this error in all Amazon Web Services Regions except in the North Virginia Region. For legacy compatibility, if you re-create an existing bucket that you already own in the North Virginia Region, Amazon S3 returns 200 OK and resets the bucket access control lists (ACLs).    Code: 409 Conflict (in all Regions except the North Virginia Region)     SOAP Fault Code Prefix: Client        Code: BucketNotEmpty    Description: The bucket you tried to delete is not empty.    HTTP Status Code: 409 Conflict    SOAP Fault Code Prefix: Client        Code: CredentialsNotSupported    Description: This request does not support credentials.    HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: CrossLocationLoggingProhibited    Description: Cross-location logging not allowed. Buckets in one geographic location cannot log information to a bucket in another location.    HTTP Status Code: 403 Forbidden    SOAP Fault Code Prefix: Client        Code: EntityTooSmall    Description: Your proposed upload is smaller than the minimum allowed object size.    HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: EntityTooLarge    Description: Your proposed upload exceeds the maximum allowed object size.    HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: ExpiredToken    Description: The provided token has expired.    HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: IllegalVersioningConfigurationException     Description: Indicates that the versioning configuration specified in the request is invalid.    HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: IncompleteBody    Description: You did not provide the number of bytes specified by the Content-Length HTTP header    HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: IncorrectNumberOfFilesInPostRequest    Description: POST requires exactly one file upload per request.    HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: InlineDataTooLarge    Description: Inline data exceeds the maximum allowed size.    HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: InternalError    Description: We encountered an internal error. Please try again.    HTTP Status Code: 500 Internal Server Error    SOAP Fault Code Prefix: Server        Code: InvalidAccessKeyId    Description: The Amazon Web Services access key ID you provided does not exist in our records.    HTTP Status Code: 403 Forbidden    SOAP Fault Code Prefix: Client        Code: InvalidAddressingHeader    Description: You must specify the Anonymous role.    HTTP Status Code: N/A    SOAP Fault Code Prefix: Client        Code: InvalidArgument    Description: Invalid Argument    HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: InvalidBucketName    Description: The specified bucket is not valid.    HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: InvalidBucketState    Description: The request is not valid with the current state of the bucket.    HTTP Status Code: 409 Conflict    SOAP Fault Code Prefix: Client        Code: InvalidDigest    Description: The Content-MD5 you specified is not valid.    HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: InvalidEncryptionAlgorithmError    Description: The encryption request you specified is not valid. The valid value is AES256.    HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: InvalidLocationConstraint    Description: The specified location constraint is not valid. For more information about Regions, see How to Select a Region for Your Buckets.     HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: InvalidObjectState    Description: The action is not valid for the current state of the object.    HTTP Status Code: 403 Forbidden    SOAP Fault Code Prefix: Client        Code: InvalidPart    Description: One or more of the specified parts could not be found. The part might not have been uploaded, or the specified entity tag might not have matched the part's entity tag.    HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: InvalidPartOrder    Description: The list of parts was not in ascending order. Parts list must be specified in order by part number.    HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: InvalidPayer    Description: All access to this object has been disabled. Please contact Amazon Web Services Support for further assistance.    HTTP Status Code: 403 Forbidden    SOAP Fault Code Prefix: Client        Code: InvalidPolicyDocument    Description: The content of the form does not meet the conditions specified in the policy document.    HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: InvalidRange    Description: The requested range cannot be satisfied.    HTTP Status Code: 416 Requested Range Not Satisfiable    SOAP Fault Code Prefix: Client        Code: InvalidRequest    Description: Please use AWS4-HMAC-SHA256.    HTTP Status Code: 400 Bad Request    Code: N/A        Code: InvalidRequest    Description: SOAP requests must be made over an HTTPS connection.    HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: InvalidRequest    Description: Amazon S3 Transfer Acceleration is not supported for buckets with non-DNS compliant names.    HTTP Status Code: 400 Bad Request    Code: N/A        Code: InvalidRequest    Description: Amazon S3 Transfer Acceleration is not supported for buckets with periods (.) in their names.    HTTP Status Code: 400 Bad Request    Code: N/A        Code: InvalidRequest    Description: Amazon S3 Transfer Accelerate endpoint only supports virtual style requests.    HTTP Status Code: 400 Bad Request    Code: N/A        Code: InvalidRequest    Description: Amazon S3 Transfer Accelerate is not configured on this bucket.    HTTP Status Code: 400 Bad Request    Code: N/A        Code: InvalidRequest    Description: Amazon S3 Transfer Accelerate is disabled on this bucket.    HTTP Status Code: 400 Bad Request    Code: N/A        Code: InvalidRequest    Description: Amazon S3 Transfer Acceleration is not supported on this bucket. Contact Amazon Web Services Support for more information.    HTTP Status Code: 400 Bad Request    Code: N/A        Code: InvalidRequest    Description: Amazon S3 Transfer Acceleration cannot be enabled on this bucket. Contact Amazon Web Services Support for more information.    HTTP Status Code: 400 Bad Request    Code: N/A        Code: InvalidSecurity    Description: The provided security credentials are not valid.    HTTP Status Code: 403 Forbidden    SOAP Fault Code Prefix: Client        Code: InvalidSOAPRequest    Description: The SOAP request body is invalid.    HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: InvalidStorageClass    Description: The storage class you specified is not valid.    HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: InvalidTargetBucketForLogging    Description: The target bucket for logging does not exist, is not owned by you, or does not have the appropriate grants for the log-delivery group.     HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: InvalidToken    Description: The provided token is malformed or otherwise invalid.    HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: InvalidURI    Description: Couldn't parse the specified URI.    HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: KeyTooLongError    Description: Your key is too long.    HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: MalformedACLError    Description: The XML you provided was not well-formed or did not validate against our published schema.    HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: MalformedPOSTRequest     Description: The body of your POST request is not well-formed multipart/form-data.    HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: MalformedXML    Description: This happens when the user sends malformed XML (XML that doesn't conform to the published XSD) for the configuration. The error message is, "The XML you provided was not well-formed or did not validate against our published schema."     HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: MaxMessageLengthExceeded    Description: Your request was too big.    HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: MaxPostPreDataLengthExceededError    Description: Your POST request fields preceding the upload file were too large.    HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: MetadataTooLarge    Description: Your metadata headers exceed the maximum allowed metadata size.    HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: MethodNotAllowed    Description: The specified method is not allowed against this resource.    HTTP Status Code: 405 Method Not Allowed    SOAP Fault Code Prefix: Client        Code: MissingAttachment    Description: A SOAP attachment was expected, but none were found.    HTTP Status Code: N/A    SOAP Fault Code Prefix: Client        Code: MissingContentLength    Description: You must provide the Content-Length HTTP header.    HTTP Status Code: 411 Length Required    SOAP Fault Code Prefix: Client        Code: MissingRequestBodyError    Description: This happens when the user sends an empty XML document as a request. The error message is, "Request body is empty."     HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: MissingSecurityElement    Description: The SOAP 1.1 request is missing a security element.    HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: MissingSecurityHeader    Description: Your request is missing a required header.    HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: NoLoggingStatusForKey    Description: There is no such thing as a logging status subresource for a key.    HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: NoSuchBucket    Description: The specified bucket does not exist.    HTTP Status Code: 404 Not Found    SOAP Fault Code Prefix: Client        Code: NoSuchBucketPolicy    Description: The specified bucket does not have a bucket policy.    HTTP Status Code: 404 Not Found    SOAP Fault Code Prefix: Client        Code: NoSuchKey    Description: The specified key does not exist.    HTTP Status Code: 404 Not Found    SOAP Fault Code Prefix: Client        Code: NoSuchLifecycleConfiguration    Description: The lifecycle configuration does not exist.     HTTP Status Code: 404 Not Found    SOAP Fault Code Prefix: Client        Code: NoSuchUpload    Description: The specified multipart upload does not exist. The upload ID might be invalid, or the multipart upload might have been aborted or completed.    HTTP Status Code: 404 Not Found    SOAP Fault Code Prefix: Client        Code: NoSuchVersion     Description: Indicates that the version ID specified in the request does not match an existing version.    HTTP Status Code: 404 Not Found    SOAP Fault Code Prefix: Client        Code: NotImplemented    Description: A header you provided implies functionality that is not implemented.    HTTP Status Code: 501 Not Implemented    SOAP Fault Code Prefix: Server        Code: NotSignedUp    Description: Your account is not signed up for the Amazon S3 service. You must sign up before you can use Amazon S3. You can sign up at the following URL: Amazon S3     HTTP Status Code: 403 Forbidden    SOAP Fault Code Prefix: Client        Code: OperationAborted    Description: A conflicting conditional action is currently in progress against this resource. Try again.    HTTP Status Code: 409 Conflict    SOAP Fault Code Prefix: Client        Code: PermanentRedirect    Description: The bucket you are attempting to access must be addressed using the specified endpoint. Send all future requests to this endpoint.    HTTP Status Code: 301 Moved Permanently    SOAP Fault Code Prefix: Client        Code: PreconditionFailed    Description: At least one of the preconditions you specified did not hold.    HTTP Status Code: 412 Precondition Failed    SOAP Fault Code Prefix: Client        Code: Redirect    Description: Temporary redirect.    HTTP Status Code: 307 Moved Temporarily    SOAP Fault Code Prefix: Client        Code: RestoreAlreadyInProgress    Description: Object restore is already in progress.    HTTP Status Code: 409 Conflict    SOAP Fault Code Prefix: Client        Code: RequestIsNotMultiPartContent    Description: Bucket POST must be of the enclosure-type multipart/form-data.    HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: RequestTimeout    Description: Your socket connection to the server was not read from or written to within the timeout period.    HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: RequestTimeTooSkewed    Description: The difference between the request time and the server's time is too large.    HTTP Status Code: 403 Forbidden    SOAP Fault Code Prefix: Client        Code: RequestTorrentOfBucketError    Description: Requesting the torrent file of a bucket is not permitted.    HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: SignatureDoesNotMatch    Description: The request signature we calculated does not match the signature you provided. Check your Amazon Web Services secret access key and signing method. For more information, see REST Authentication and SOAP Authentication for details.    HTTP Status Code: 403 Forbidden    SOAP Fault Code Prefix: Client        Code: ServiceUnavailable    Description: Reduce your request rate.    HTTP Status Code: 503 Service Unavailable    SOAP Fault Code Prefix: Server        Code: SlowDown    Description: Reduce your request rate.    HTTP Status Code: 503 Slow Down    SOAP Fault Code Prefix: Server        Code: TemporaryRedirect    Description: You are being redirected to the bucket while DNS updates.    HTTP Status Code: 307 Moved Temporarily    SOAP Fault Code Prefix: Client        Code: TokenRefreshRequired    Description: The provided token must be refreshed.    HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: TooManyBuckets    Description: You have attempted to create more buckets than allowed.    HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: UnexpectedContent    Description: This request does not support content.    HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: UnresolvableGrantByEmailAddress    Description: The email address you provided does not match any account on record.    HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client        Code: UserKeyMustBeSpecified    Description: The bucket POST must contain the specified field name. If it is specified, check the order of the fields.    HTTP Status Code: 400 Bad Request    SOAP Fault Code Prefix: Client
     */
    Code?: Code
    /**
     * The error message contains a generic description of the error condition in English. It is intended for a human audience. Simple programs display the message directly to the end user if they encounter an error condition they don't know how or don't care to handle. Sophisticated programs with more exhaustive error handling and proper internationalization are more likely to ignore the error message.
     */
    Message?: Message
  }
  export type ErrorCode = string
  export interface ErrorDocument {
    /**
     * The object key name to use when a 4XX class error occurs.  Replacement must be made for object keys containing special characters (such as carriage returns) when using XML requests. For more information, see  XML related object key constraints.
     */
    Key: ObjectKey
  }
  export type ErrorMessage = string
  export type Errors = Error[]
  export type Event =
    | 's3:ReducedRedundancyLostObject'
    | 's3:ObjectCreated:*'
    | 's3:ObjectCreated:Put'
    | 's3:ObjectCreated:Post'
    | 's3:ObjectCreated:Copy'
    | 's3:ObjectCreated:CompleteMultipartUpload'
    | 's3:ObjectRemoved:*'
    | 's3:ObjectRemoved:Delete'
    | 's3:ObjectRemoved:DeleteMarkerCreated'
    | 's3:ObjectRestore:*'
    | 's3:ObjectRestore:Post'
    | 's3:ObjectRestore:Completed'
    | 's3:Replication:*'
    | 's3:Replication:OperationFailedReplication'
    | 's3:Replication:OperationNotTracked'
    | 's3:Replication:OperationMissedThreshold'
    | 's3:Replication:OperationReplicatedAfterThreshold'
    | 's3:ObjectRestore:Delete'
    | 's3:LifecycleTransition'
    | 's3:IntelligentTiering'
    | 's3:ObjectAcl:Put'
    | 's3:LifecycleExpiration:*'
    | 's3:LifecycleExpiration:Delete'
    | 's3:LifecycleExpiration:DeleteMarkerCreated'
    | 's3:ObjectTagging:*'
    | 's3:ObjectTagging:Put'
    | 's3:ObjectTagging:Delete'
    | string
  export interface EventBridgeConfiguration {}
  export type EventList = Event[]
  export interface ExistingObjectReplication {
    /**
     *
     */
    Status: ExistingObjectReplicationStatus
  }
  export type ExistingObjectReplicationStatus = 'Enabled' | 'Disabled' | string
  export type Expiration = string
  export type ExpirationStatus = 'Enabled' | 'Disabled' | string
  export type ExpiredObjectDeleteMarker = boolean
  export type Expires = Date
  export type ExposeHeader = string
  export type ExposeHeaders = ExposeHeader[]
  export type Expression = string
  export type ExpressionType = 'SQL' | string
  export type FetchOwner = boolean
  export type FieldDelimiter = string
  export type FileHeaderInfo = 'USE' | 'IGNORE' | 'NONE' | string
  export interface FilterRule {
    /**
     * The object key name prefix or suffix identifying one or more objects to which the filtering rule applies. The maximum length is 1,024 characters. Overlapping prefixes and suffixes are not supported. For more information, see Configuring Event Notifications in the Amazon S3 User Guide.
     */
    Name?: FilterRuleName
    /**
     * The value that the filter searches for in object key names.
     */
    Value?: FilterRuleValue
  }
  export type FilterRuleList = FilterRule[]
  export type FilterRuleName = 'prefix' | 'suffix' | string
  export type FilterRuleValue = string
  export interface GetBucketAccelerateConfigurationOutput {
    /**
     * The accelerate configuration of the bucket.
     */
    Status?: BucketAccelerateStatus
  }
  export interface GetBucketAccelerateConfigurationRequest {
    /**
     * The name of the bucket for which the accelerate configuration is retrieved.
     */
    Bucket: BucketName
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface GetBucketAclOutput {
    /**
     * Container for the bucket owner's display name and ID.
     */
    Owner?: Owner
    /**
     * A list of grants.
     */
    Grants?: Grants
  }
  export interface GetBucketAclRequest {
    /**
     * Specifies the S3 bucket whose ACL is being requested.
     */
    Bucket: BucketName
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface GetBucketAnalyticsConfigurationOutput {
    /**
     * The configuration and any analyses for the analytics filter.
     */
    AnalyticsConfiguration?: AnalyticsConfiguration
  }
  export interface GetBucketAnalyticsConfigurationRequest {
    /**
     * The name of the bucket from which an analytics configuration is retrieved.
     */
    Bucket: BucketName
    /**
     * The ID that identifies the analytics configuration.
     */
    Id: AnalyticsId
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface GetBucketCorsOutput {
    /**
     * A set of origins and methods (cross-origin access that you want to allow). You can add up to 100 rules to the configuration.
     */
    CORSRules?: CORSRules
  }
  export interface GetBucketCorsRequest {
    /**
     * The bucket name for which to get the cors configuration.
     */
    Bucket: BucketName
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface GetBucketEncryptionOutput {
    ServerSideEncryptionConfiguration?: ServerSideEncryptionConfiguration
  }
  export interface GetBucketEncryptionRequest {
    /**
     * The name of the bucket from which the server-side encryption configuration is retrieved.
     */
    Bucket: BucketName
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface GetBucketIntelligentTieringConfigurationOutput {
    /**
     * Container for S3 Intelligent-Tiering configuration.
     */
    IntelligentTieringConfiguration?: IntelligentTieringConfiguration
  }
  export interface GetBucketIntelligentTieringConfigurationRequest {
    /**
     * The name of the Amazon S3 bucket whose configuration you want to modify or retrieve.
     */
    Bucket: BucketName
    /**
     * The ID used to identify the S3 Intelligent-Tiering configuration.
     */
    Id: IntelligentTieringId
  }
  export interface GetBucketInventoryConfigurationOutput {
    /**
     * Specifies the inventory configuration.
     */
    InventoryConfiguration?: InventoryConfiguration
  }
  export interface GetBucketInventoryConfigurationRequest {
    /**
     * The name of the bucket containing the inventory configuration to retrieve.
     */
    Bucket: BucketName
    /**
     * The ID used to identify the inventory configuration.
     */
    Id: InventoryId
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface GetBucketLifecycleConfigurationOutput {
    /**
     * Container for a lifecycle rule.
     */
    Rules?: LifecycleRules
  }
  export interface GetBucketLifecycleConfigurationRequest {
    /**
     * The name of the bucket for which to get the lifecycle information.
     */
    Bucket: BucketName
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface GetBucketLifecycleOutput {
    /**
     * Container for a lifecycle rule.
     */
    Rules?: Rules
  }
  export interface GetBucketLifecycleRequest {
    /**
     * The name of the bucket for which to get the lifecycle information.
     */
    Bucket: BucketName
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface GetBucketLocationOutput {
    /**
     * Specifies the Region where the bucket resides. For a list of all the Amazon S3 supported location constraints by Region, see Regions and Endpoints. Buckets in Region us-east-1 have a LocationConstraint of null.
     */
    LocationConstraint?: BucketLocationConstraint
  }
  export interface GetBucketLocationRequest {
    /**
     * The name of the bucket for which to get the location.
     */
    Bucket: BucketName
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface GetBucketLoggingOutput {
    LoggingEnabled?: LoggingEnabled
  }
  export interface GetBucketLoggingRequest {
    /**
     * The bucket name for which to get the logging information.
     */
    Bucket: BucketName
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface GetBucketMetricsConfigurationOutput {
    /**
     * Specifies the metrics configuration.
     */
    MetricsConfiguration?: MetricsConfiguration
  }
  export interface GetBucketMetricsConfigurationRequest {
    /**
     * The name of the bucket containing the metrics configuration to retrieve.
     */
    Bucket: BucketName
    /**
     * The ID used to identify the metrics configuration.
     */
    Id: MetricsId
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface GetBucketNotificationConfigurationRequest {
    /**
     * The name of the bucket for which to get the notification configuration.
     */
    Bucket: BucketName
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface GetBucketOwnershipControlsOutput {
    /**
     * The OwnershipControls (BucketOwnerEnforced, BucketOwnerPreferred, or ObjectWriter) currently in effect for this Amazon S3 bucket.
     */
    OwnershipControls?: OwnershipControls
  }
  export interface GetBucketOwnershipControlsRequest {
    /**
     * The name of the Amazon S3 bucket whose OwnershipControls you want to retrieve.
     */
    Bucket: BucketName
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface GetBucketPolicyOutput {
    /**
     * The bucket policy as a JSON document.
     */
    Policy?: Policy
  }
  export interface GetBucketPolicyRequest {
    /**
     * The bucket name for which to get the bucket policy.
     */
    Bucket: BucketName
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface GetBucketPolicyStatusOutput {
    /**
     * The policy status for the specified bucket.
     */
    PolicyStatus?: PolicyStatus
  }
  export interface GetBucketPolicyStatusRequest {
    /**
     * The name of the Amazon S3 bucket whose policy status you want to retrieve.
     */
    Bucket: BucketName
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface GetBucketReplicationOutput {
    ReplicationConfiguration?: ReplicationConfiguration
  }
  export interface GetBucketReplicationRequest {
    /**
     * The bucket name for which to get the replication information.
     */
    Bucket: BucketName
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface GetBucketRequestPaymentOutput {
    /**
     * Specifies who pays for the download and request fees.
     */
    Payer?: Payer
  }
  export interface GetBucketRequestPaymentRequest {
    /**
     * The name of the bucket for which to get the payment request configuration
     */
    Bucket: BucketName
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface GetBucketTaggingOutput {
    /**
     * Contains the tag set.
     */
    TagSet: TagSet
  }
  export interface GetBucketTaggingRequest {
    /**
     * The name of the bucket for which to get the tagging information.
     */
    Bucket: BucketName
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface GetBucketVersioningOutput {
    /**
     * The versioning state of the bucket.
     */
    Status?: BucketVersioningStatus
    /**
     * Specifies whether MFA delete is enabled in the bucket versioning configuration. This element is only returned if the bucket has been configured with MFA delete. If the bucket has never been so configured, this element is not returned.
     */
    MFADelete?: MFADeleteStatus
  }
  export interface GetBucketVersioningRequest {
    /**
     * The name of the bucket for which to get the versioning information.
     */
    Bucket: BucketName
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface GetBucketWebsiteOutput {
    /**
     * Specifies the redirect behavior of all requests to a website endpoint of an Amazon S3 bucket.
     */
    RedirectAllRequestsTo?: RedirectAllRequestsTo
    /**
     * The name of the index document for the website (for example index.html).
     */
    IndexDocument?: IndexDocument
    /**
     * The object key name of the website error document to use for 4XX class errors.
     */
    ErrorDocument?: ErrorDocument
    /**
     * Rules that define when a redirect is applied and the redirect behavior.
     */
    RoutingRules?: RoutingRules
  }
  export interface GetBucketWebsiteRequest {
    /**
     * The bucket name for which to get the website configuration.
     */
    Bucket: BucketName
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface GetObjectAclOutput {
    /**
     *  Container for the bucket owner's display name and ID.
     */
    Owner?: Owner
    /**
     * A list of grants.
     */
    Grants?: Grants
    RequestCharged?: RequestCharged
  }
  export interface GetObjectAclRequest {
    /**
     * The bucket name that contains the object for which to get the ACL information.  When using this action with an access point, you must direct requests to the access point hostname. The access point hostname takes the form AccessPointName-AccountId.s3-accesspoint.Region.amazonaws.com. When using this action with an access point through the Amazon Web Services SDKs, you provide the access point ARN in place of the bucket name. For more information about access point ARNs, see Using access points in the Amazon S3 User Guide.
     */
    Bucket: BucketName
    /**
     * The key of the object for which to get the ACL information.
     */
    Key: ObjectKey
    /**
     * VersionId used to reference a specific version of the object.
     */
    VersionId?: ObjectVersionId
    RequestPayer?: RequestPayer
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface GetObjectAttributesOutput {
    /**
     * Specifies whether the object retrieved was (true) or was not (false) a delete marker. If false, this response header does not appear in the response.
     */
    DeleteMarker?: DeleteMarker
    /**
     * The creation date of the object.
     */
    LastModified?: LastModified
    /**
     * The version ID of the object.
     */
    VersionId?: ObjectVersionId
    RequestCharged?: RequestCharged
    /**
     * An ETag is an opaque identifier assigned by a web server to a specific version of a resource found at a URL.
     */
    ETag?: ETag
    /**
     * The checksum or digest of the object.
     */
    Checksum?: Checksum
    /**
     * A collection of parts associated with a multipart upload.
     */
    ObjectParts?: GetObjectAttributesParts
    /**
     * Provides the storage class information of the object. Amazon S3 returns this header for all objects except for S3 Standard storage class objects. For more information, see Storage Classes.
     */
    StorageClass?: StorageClass
    /**
     * The size of the object in bytes.
     */
    ObjectSize?: ObjectSize
  }
  export interface GetObjectAttributesParts {
    /**
     * The total number of parts.
     */
    TotalPartsCount?: PartsCount
    /**
     * The marker for the current part.
     */
    PartNumberMarker?: PartNumberMarker
    /**
     * When a list is truncated, this element specifies the last part in the list, as well as the value to use for the PartNumberMarker request parameter in a subsequent request.
     */
    NextPartNumberMarker?: NextPartNumberMarker
    /**
     * The maximum number of parts allowed in the response.
     */
    MaxParts?: MaxParts
    /**
     * Indicates whether the returned list of parts is truncated. A value of true indicates that the list was truncated. A list can be truncated if the number of parts exceeds the limit returned in the MaxParts element.
     */
    IsTruncated?: IsTruncated
    /**
     * A container for elements related to a particular part. A response can contain zero or more Parts elements.
     */
    Parts?: PartsList
  }
  export interface GetObjectAttributesRequest {
    /**
     * The name of the bucket that contains the object. When using this action with an access point, you must direct requests to the access point hostname. The access point hostname takes the form AccessPointName-AccountId.s3-accesspoint.Region.amazonaws.com. When using this action with an access point through the Amazon Web Services SDKs, you provide the access point ARN in place of the bucket name. For more information about access point ARNs, see Using access points in the Amazon S3 User Guide. When using this action with Amazon S3 on Outposts, you must direct requests to the S3 on Outposts hostname. The S3 on Outposts hostname takes the form  AccessPointName-AccountId.outpostID.s3-outposts.Region.amazonaws.com. When using this action with S3 on Outposts through the Amazon Web Services SDKs, you provide the Outposts bucket ARN in place of the bucket name. For more information about S3 on Outposts ARNs, see Using Amazon S3 on Outposts in the Amazon S3 User Guide.
     */
    Bucket: BucketName
    /**
     * The object key.
     */
    Key: ObjectKey
    /**
     * The version ID used to reference a specific version of the object.
     */
    VersionId?: ObjectVersionId
    /**
     * Sets the maximum number of parts to return.
     */
    MaxParts?: MaxParts
    /**
     * Specifies the part after which listing should begin. Only parts with higher part numbers will be listed.
     */
    PartNumberMarker?: PartNumberMarker
    /**
     * Specifies the algorithm to use when encrypting the object (for example, AES256).
     */
    SSECustomerAlgorithm?: SSECustomerAlgorithm
    /**
     * Specifies the customer-provided encryption key for Amazon S3 to use in encrypting data. This value is used to store the object and then it is discarded; Amazon S3 does not store the encryption key. The key must be appropriate for use with the algorithm specified in the x-amz-server-side-encryption-customer-algorithm header.
     */
    SSECustomerKey?: SSECustomerKey
    /**
     * Specifies the 128-bit MD5 digest of the encryption key according to RFC 1321. Amazon S3 uses this header for a message integrity check to ensure that the encryption key was transmitted without error.
     */
    SSECustomerKeyMD5?: SSECustomerKeyMD5
    RequestPayer?: RequestPayer
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
    /**
     * An XML header that specifies the fields at the root level that you want returned in the response. Fields that you do not specify are not returned.
     */
    ObjectAttributes: ObjectAttributesList
  }
  export interface GetObjectLegalHoldOutput {
    /**
     * The current legal hold status for the specified object.
     */
    LegalHold?: ObjectLockLegalHold
  }
  export interface GetObjectLegalHoldRequest {
    /**
     * The bucket name containing the object whose legal hold status you want to retrieve.  When using this action with an access point, you must direct requests to the access point hostname. The access point hostname takes the form AccessPointName-AccountId.s3-accesspoint.Region.amazonaws.com. When using this action with an access point through the Amazon Web Services SDKs, you provide the access point ARN in place of the bucket name. For more information about access point ARNs, see Using access points in the Amazon S3 User Guide.
     */
    Bucket: BucketName
    /**
     * The key name for the object whose legal hold status you want to retrieve.
     */
    Key: ObjectKey
    /**
     * The version ID of the object whose legal hold status you want to retrieve.
     */
    VersionId?: ObjectVersionId
    RequestPayer?: RequestPayer
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface GetObjectLockConfigurationOutput {
    /**
     * The specified bucket's Object Lock configuration.
     */
    ObjectLockConfiguration?: ObjectLockConfiguration
  }
  export interface GetObjectLockConfigurationRequest {
    /**
     * The bucket whose Object Lock configuration you want to retrieve. When using this action with an access point, you must direct requests to the access point hostname. The access point hostname takes the form AccessPointName-AccountId.s3-accesspoint.Region.amazonaws.com. When using this action with an access point through the Amazon Web Services SDKs, you provide the access point ARN in place of the bucket name. For more information about access point ARNs, see Using access points in the Amazon S3 User Guide.
     */
    Bucket: BucketName
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface GetObjectOutput {
    /**
     * Object data.
     */
    Body?: Body
    /**
     * Specifies whether the object retrieved was (true) or was not (false) a Delete Marker. If false, this response header does not appear in the response.
     */
    DeleteMarker?: DeleteMarker
    /**
     * Indicates that a range of bytes was specified.
     */
    AcceptRanges?: AcceptRanges
    /**
     * If the object expiration is configured (see PUT Bucket lifecycle), the response includes this header. It includes the expiry-date and rule-id key-value pairs providing object expiration information. The value of the rule-id is URL-encoded.
     */
    Expiration?: Expiration
    /**
     * Provides information about object restoration action and expiration time of the restored object copy.
     */
    Restore?: Restore
    /**
     * Creation date of the object.
     */
    LastModified?: LastModified
    /**
     * Size of the body in bytes.
     */
    ContentLength?: ContentLength
    /**
     * An entity tag (ETag) is an opaque identifier assigned by a web server to a specific version of a resource found at a URL.
     */
    ETag?: ETag
    /**
     * The base64-encoded, 32-bit CRC32 checksum of the object. This will only be present if it was uploaded with the object. With multipart uploads, this may not be a checksum value of the object. For more information about how checksums are calculated with multipart uploads, see  Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumCRC32?: ChecksumCRC32
    /**
     * The base64-encoded, 32-bit CRC32C checksum of the object. This will only be present if it was uploaded with the object. With multipart uploads, this may not be a checksum value of the object. For more information about how checksums are calculated with multipart uploads, see  Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumCRC32C?: ChecksumCRC32C
    /**
     * The base64-encoded, 160-bit SHA-1 digest of the object. This will only be present if it was uploaded with the object. With multipart uploads, this may not be a checksum value of the object. For more information about how checksums are calculated with multipart uploads, see  Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumSHA1?: ChecksumSHA1
    /**
     * The base64-encoded, 256-bit SHA-256 digest of the object. This will only be present if it was uploaded with the object. With multipart uploads, this may not be a checksum value of the object. For more information about how checksums are calculated with multipart uploads, see  Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumSHA256?: ChecksumSHA256
    /**
     * This is set to the number of metadata entries not returned in x-amz-meta headers. This can happen if you create metadata using an API like SOAP that supports more flexible metadata than the REST API. For example, using SOAP, you can create metadata whose values are not legal HTTP headers.
     */
    MissingMeta?: MissingMeta
    /**
     * Version of the object.
     */
    VersionId?: ObjectVersionId
    /**
     * Specifies caching behavior along the request/reply chain.
     */
    CacheControl?: CacheControl
    /**
     * Specifies presentational information for the object.
     */
    ContentDisposition?: ContentDisposition
    /**
     * Specifies what content encodings have been applied to the object and thus what decoding mechanisms must be applied to obtain the media-type referenced by the Content-Type header field.
     */
    ContentEncoding?: ContentEncoding
    /**
     * The language the content is in.
     */
    ContentLanguage?: ContentLanguage
    /**
     * The portion of the object returned in the response.
     */
    ContentRange?: ContentRange
    /**
     * A standard MIME type describing the format of the object data.
     */
    ContentType?: ContentType
    /**
     * The date and time at which the object is no longer cacheable.
     */
    Expires?: Expires
    /**
     * If the bucket is configured as a website, redirects requests for this object to another object in the same bucket or to an external URL. Amazon S3 stores the value of this header in the object metadata.
     */
    WebsiteRedirectLocation?: WebsiteRedirectLocation
    /**
     * The server-side encryption algorithm used when storing this object in Amazon S3 (for example, AES256, aws:kms).
     */
    ServerSideEncryption?: ServerSideEncryption
    /**
     * A map of metadata to store with the object in S3.
     */
    Metadata?: Metadata
    /**
     * If server-side encryption with a customer-provided encryption key was requested, the response will include this header confirming the encryption algorithm used.
     */
    SSECustomerAlgorithm?: SSECustomerAlgorithm
    /**
     * If server-side encryption with a customer-provided encryption key was requested, the response will include this header to provide round-trip message integrity verification of the customer-provided encryption key.
     */
    SSECustomerKeyMD5?: SSECustomerKeyMD5
    /**
     * If present, specifies the ID of the Amazon Web Services Key Management Service (Amazon Web Services KMS) symmetric customer managed key that was used for the object.
     */
    SSEKMSKeyId?: SSEKMSKeyId
    /**
     * Indicates whether the object uses an S3 Bucket Key for server-side encryption with Amazon Web Services KMS (SSE-KMS).
     */
    BucketKeyEnabled?: BucketKeyEnabled
    /**
     * Provides storage class information of the object. Amazon S3 returns this header for all objects except for S3 Standard storage class objects.
     */
    StorageClass?: StorageClass
    RequestCharged?: RequestCharged
    /**
     * Amazon S3 can return this if your request involves a bucket that is either a source or destination in a replication rule.
     */
    ReplicationStatus?: ReplicationStatus
    /**
     * The count of parts this object has. This value is only returned if you specify partNumber in your request and the object was uploaded as a multipart upload.
     */
    PartsCount?: PartsCount
    /**
     * The number of tags, if any, on the object.
     */
    TagCount?: TagCount
    /**
     * The Object Lock mode currently in place for this object.
     */
    ObjectLockMode?: ObjectLockMode
    /**
     * The date and time when this object's Object Lock will expire.
     */
    ObjectLockRetainUntilDate?: ObjectLockRetainUntilDate
    /**
     * Indicates whether this object has an active legal hold. This field is only returned if you have permission to view an object's legal hold status.
     */
    ObjectLockLegalHoldStatus?: ObjectLockLegalHoldStatus
  }
  export interface GetObjectRequest {
    /**
     * The bucket name containing the object.  When using this action with an access point, you must direct requests to the access point hostname. The access point hostname takes the form AccessPointName-AccountId.s3-accesspoint.Region.amazonaws.com. When using this action with an access point through the Amazon Web Services SDKs, you provide the access point ARN in place of the bucket name. For more information about access point ARNs, see Using access points in the Amazon S3 User Guide. When using an Object Lambda access point the hostname takes the form AccessPointName-AccountId.s3-object-lambda.Region.amazonaws.com. When using this action with Amazon S3 on Outposts, you must direct requests to the S3 on Outposts hostname. The S3 on Outposts hostname takes the form  AccessPointName-AccountId.outpostID.s3-outposts.Region.amazonaws.com. When using this action with S3 on Outposts through the Amazon Web Services SDKs, you provide the Outposts bucket ARN in place of the bucket name. For more information about S3 on Outposts ARNs, see Using Amazon S3 on Outposts in the Amazon S3 User Guide.
     */
    Bucket: BucketName
    /**
     * Return the object only if its entity tag (ETag) is the same as the one specified; otherwise, return a 412 (precondition failed) error.
     */
    IfMatch?: IfMatch
    /**
     * Return the object only if it has been modified since the specified time; otherwise, return a 304 (not modified) error.
     */
    IfModifiedSince?: IfModifiedSince
    /**
     * Return the object only if its entity tag (ETag) is different from the one specified; otherwise, return a 304 (not modified) error.
     */
    IfNoneMatch?: IfNoneMatch
    /**
     * Return the object only if it has not been modified since the specified time; otherwise, return a 412 (precondition failed) error.
     */
    IfUnmodifiedSince?: IfUnmodifiedSince
    /**
     * Key of the object to get.
     */
    Key: ObjectKey
    /**
     * Downloads the specified range bytes of an object. For more information about the HTTP Range header, see https://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.35.  Amazon S3 doesn't support retrieving multiple ranges of data per GET request.
     */
    Range?: Range
    /**
     * Sets the Cache-Control header of the response.
     */
    ResponseCacheControl?: ResponseCacheControl
    /**
     * Sets the Content-Disposition header of the response
     */
    ResponseContentDisposition?: ResponseContentDisposition
    /**
     * Sets the Content-Encoding header of the response.
     */
    ResponseContentEncoding?: ResponseContentEncoding
    /**
     * Sets the Content-Language header of the response.
     */
    ResponseContentLanguage?: ResponseContentLanguage
    /**
     * Sets the Content-Type header of the response.
     */
    ResponseContentType?: ResponseContentType
    /**
     * Sets the Expires header of the response.
     */
    ResponseExpires?: ResponseExpires
    /**
     * VersionId used to reference a specific version of the object.
     */
    VersionId?: ObjectVersionId
    /**
     * Specifies the algorithm to use to when decrypting the object (for example, AES256).
     */
    SSECustomerAlgorithm?: SSECustomerAlgorithm
    /**
     * Specifies the customer-provided encryption key for Amazon S3 used to encrypt the data. This value is used to decrypt the object when recovering it and must match the one used when storing the data. The key must be appropriate for use with the algorithm specified in the x-amz-server-side-encryption-customer-algorithm header.
     */
    SSECustomerKey?: SSECustomerKey
    /**
     * Specifies the 128-bit MD5 digest of the encryption key according to RFC 1321. Amazon S3 uses this header for a message integrity check to ensure that the encryption key was transmitted without error.
     */
    SSECustomerKeyMD5?: SSECustomerKeyMD5
    RequestPayer?: RequestPayer
    /**
     * Part number of the object being read. This is a positive integer between 1 and 10,000. Effectively performs a 'ranged' GET request for the part specified. Useful for downloading just a part of an object.
     */
    PartNumber?: PartNumber
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
    /**
     * To retrieve the checksum, this mode must be enabled.
     */
    ChecksumMode?: ChecksumMode
  }
  export type GetObjectResponseStatusCode = number
  export interface GetObjectRetentionOutput {
    /**
     * The container element for an object's retention settings.
     */
    Retention?: ObjectLockRetention
  }
  export interface GetObjectRetentionRequest {
    /**
     * The bucket name containing the object whose retention settings you want to retrieve.  When using this action with an access point, you must direct requests to the access point hostname. The access point hostname takes the form AccessPointName-AccountId.s3-accesspoint.Region.amazonaws.com. When using this action with an access point through the Amazon Web Services SDKs, you provide the access point ARN in place of the bucket name. For more information about access point ARNs, see Using access points in the Amazon S3 User Guide.
     */
    Bucket: BucketName
    /**
     * The key name for the object whose retention settings you want to retrieve.
     */
    Key: ObjectKey
    /**
     * The version ID for the object whose retention settings you want to retrieve.
     */
    VersionId?: ObjectVersionId
    RequestPayer?: RequestPayer
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface GetObjectTaggingOutput {
    /**
     * The versionId of the object for which you got the tagging information.
     */
    VersionId?: ObjectVersionId
    /**
     * Contains the tag set.
     */
    TagSet: TagSet
  }
  export interface GetObjectTaggingRequest {
    /**
     * The bucket name containing the object for which to get the tagging information.  When using this action with an access point, you must direct requests to the access point hostname. The access point hostname takes the form AccessPointName-AccountId.s3-accesspoint.Region.amazonaws.com. When using this action with an access point through the Amazon Web Services SDKs, you provide the access point ARN in place of the bucket name. For more information about access point ARNs, see Using access points in the Amazon S3 User Guide. When using this action with Amazon S3 on Outposts, you must direct requests to the S3 on Outposts hostname. The S3 on Outposts hostname takes the form  AccessPointName-AccountId.outpostID.s3-outposts.Region.amazonaws.com. When using this action with S3 on Outposts through the Amazon Web Services SDKs, you provide the Outposts bucket ARN in place of the bucket name. For more information about S3 on Outposts ARNs, see Using Amazon S3 on Outposts in the Amazon S3 User Guide.
     */
    Bucket: BucketName
    /**
     * Object key for which to get the tagging information.
     */
    Key: ObjectKey
    /**
     * The versionId of the object for which to get the tagging information.
     */
    VersionId?: ObjectVersionId
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
    RequestPayer?: RequestPayer
  }
  export interface GetObjectTorrentOutput {
    /**
     * A Bencoded dictionary as defined by the BitTorrent specification
     */
    Body?: Body
    RequestCharged?: RequestCharged
  }
  export interface GetObjectTorrentRequest {
    /**
     * The name of the bucket containing the object for which to get the torrent files.
     */
    Bucket: BucketName
    /**
     * The object key for which to get the information.
     */
    Key: ObjectKey
    RequestPayer?: RequestPayer
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface GetPublicAccessBlockOutput {
    /**
     * The PublicAccessBlock configuration currently in effect for this Amazon S3 bucket.
     */
    PublicAccessBlockConfiguration?: PublicAccessBlockConfiguration
  }
  export interface GetPublicAccessBlockRequest {
    /**
     * The name of the Amazon S3 bucket whose PublicAccessBlock configuration you want to retrieve.
     */
    Bucket: BucketName
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface GlacierJobParameters {
    /**
     * Retrieval tier at which the restore will be processed.
     */
    Tier: Tier
  }
  export interface Grant {
    /**
     * The person being granted permissions.
     */
    Grantee?: Grantee
    /**
     * Specifies the permission given to the grantee.
     */
    Permission?: Permission
  }
  export type GrantFullControl = string
  export type GrantRead = string
  export type GrantReadACP = string
  export type GrantWrite = string
  export type GrantWriteACP = string
  export interface Grantee {
    /**
     * Screen name of the grantee.
     */
    DisplayName?: DisplayName
    /**
     * Email address of the grantee.  Using email addresses to specify a grantee is only supported in the following Amazon Web Services Regions:    US East (N. Virginia)   US West (N. California)    US West (Oregon)    Asia Pacific (Singapore)   Asia Pacific (Sydney)   Asia Pacific (Tokyo)   Europe (Ireland)   South America (São Paulo)   For a list of all the Amazon S3 supported Regions and endpoints, see Regions and Endpoints in the Amazon Web Services General Reference.
     */
    EmailAddress?: EmailAddress
    /**
     * The canonical user ID of the grantee.
     */
    ID?: ID
    /**
     * Type of grantee
     */
    Type: Type
    /**
     * URI of the grantee group.
     */
    URI?: URI
  }
  export type Grants = Grant[]
  export interface HeadBucketRequest {
    /**
     * The bucket name. When using this action with an access point, you must direct requests to the access point hostname. The access point hostname takes the form AccessPointName-AccountId.s3-accesspoint.Region.amazonaws.com. When using this action with an access point through the Amazon Web Services SDKs, you provide the access point ARN in place of the bucket name. For more information about access point ARNs, see Using access points in the Amazon S3 User Guide. When using this action with Amazon S3 on Outposts, you must direct requests to the S3 on Outposts hostname. The S3 on Outposts hostname takes the form  AccessPointName-AccountId.outpostID.s3-outposts.Region.amazonaws.com. When using this action with S3 on Outposts through the Amazon Web Services SDKs, you provide the Outposts bucket ARN in place of the bucket name. For more information about S3 on Outposts ARNs, see Using Amazon S3 on Outposts in the Amazon S3 User Guide.
     */
    Bucket: BucketName
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface HeadObjectOutput {
    /**
     * Specifies whether the object retrieved was (true) or was not (false) a Delete Marker. If false, this response header does not appear in the response.
     */
    DeleteMarker?: DeleteMarker
    /**
     * Indicates that a range of bytes was specified.
     */
    AcceptRanges?: AcceptRanges
    /**
     * If the object expiration is configured (see PUT Bucket lifecycle), the response includes this header. It includes the expiry-date and rule-id key-value pairs providing object expiration information. The value of the rule-id is URL-encoded.
     */
    Expiration?: Expiration
    /**
     * If the object is an archived object (an object whose storage class is GLACIER), the response includes this header if either the archive restoration is in progress (see RestoreObject or an archive copy is already restored.  If an archive copy is already restored, the header value indicates when Amazon S3 is scheduled to delete the object copy. For example:  x-amz-restore: ongoing-request="false", expiry-date="Fri, 21 Dec 2012 00:00:00 GMT"  If the object restoration is in progress, the header returns the value ongoing-request="true". For more information about archiving objects, see Transitioning Objects: General Considerations.
     */
    Restore?: Restore
    /**
     * The archive state of the head object.
     */
    ArchiveStatus?: ArchiveStatus
    /**
     * Creation date of the object.
     */
    LastModified?: LastModified
    /**
     * Size of the body in bytes.
     */
    ContentLength?: ContentLength
    /**
     * The base64-encoded, 32-bit CRC32 checksum of the object. This will only be present if it was uploaded with the object. With multipart uploads, this may not be a checksum value of the object. For more information about how checksums are calculated with multipart uploads, see  Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumCRC32?: ChecksumCRC32
    /**
     * The base64-encoded, 32-bit CRC32C checksum of the object. This will only be present if it was uploaded with the object. With multipart uploads, this may not be a checksum value of the object. For more information about how checksums are calculated with multipart uploads, see  Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumCRC32C?: ChecksumCRC32C
    /**
     * The base64-encoded, 160-bit SHA-1 digest of the object. This will only be present if it was uploaded with the object. With multipart uploads, this may not be a checksum value of the object. For more information about how checksums are calculated with multipart uploads, see  Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumSHA1?: ChecksumSHA1
    /**
     * The base64-encoded, 256-bit SHA-256 digest of the object. This will only be present if it was uploaded with the object. With multipart uploads, this may not be a checksum value of the object. For more information about how checksums are calculated with multipart uploads, see  Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumSHA256?: ChecksumSHA256
    /**
     * An entity tag (ETag) is an opaque identifier assigned by a web server to a specific version of a resource found at a URL.
     */
    ETag?: ETag
    /**
     * This is set to the number of metadata entries not returned in x-amz-meta headers. This can happen if you create metadata using an API like SOAP that supports more flexible metadata than the REST API. For example, using SOAP, you can create metadata whose values are not legal HTTP headers.
     */
    MissingMeta?: MissingMeta
    /**
     * Version of the object.
     */
    VersionId?: ObjectVersionId
    /**
     * Specifies caching behavior along the request/reply chain.
     */
    CacheControl?: CacheControl
    /**
     * Specifies presentational information for the object.
     */
    ContentDisposition?: ContentDisposition
    /**
     * Specifies what content encodings have been applied to the object and thus what decoding mechanisms must be applied to obtain the media-type referenced by the Content-Type header field.
     */
    ContentEncoding?: ContentEncoding
    /**
     * The language the content is in.
     */
    ContentLanguage?: ContentLanguage
    /**
     * A standard MIME type describing the format of the object data.
     */
    ContentType?: ContentType
    /**
     * The date and time at which the object is no longer cacheable.
     */
    Expires?: Expires
    /**
     * If the bucket is configured as a website, redirects requests for this object to another object in the same bucket or to an external URL. Amazon S3 stores the value of this header in the object metadata.
     */
    WebsiteRedirectLocation?: WebsiteRedirectLocation
    /**
     * If the object is stored using server-side encryption either with an Amazon Web Services KMS key or an Amazon S3-managed encryption key, the response includes this header with the value of the server-side encryption algorithm used when storing this object in Amazon S3 (for example, AES256, aws:kms).
     */
    ServerSideEncryption?: ServerSideEncryption
    /**
     * A map of metadata to store with the object in S3.
     */
    Metadata?: Metadata
    /**
     * If server-side encryption with a customer-provided encryption key was requested, the response will include this header confirming the encryption algorithm used.
     */
    SSECustomerAlgorithm?: SSECustomerAlgorithm
    /**
     * If server-side encryption with a customer-provided encryption key was requested, the response will include this header to provide round-trip message integrity verification of the customer-provided encryption key.
     */
    SSECustomerKeyMD5?: SSECustomerKeyMD5
    /**
     * If present, specifies the ID of the Amazon Web Services Key Management Service (Amazon Web Services KMS) symmetric customer managed key that was used for the object.
     */
    SSEKMSKeyId?: SSEKMSKeyId
    /**
     * Indicates whether the object uses an S3 Bucket Key for server-side encryption with Amazon Web Services KMS (SSE-KMS).
     */
    BucketKeyEnabled?: BucketKeyEnabled
    /**
     * Provides storage class information of the object. Amazon S3 returns this header for all objects except for S3 Standard storage class objects. For more information, see Storage Classes.
     */
    StorageClass?: StorageClass
    RequestCharged?: RequestCharged
    /**
     * Amazon S3 can return this header if your request involves a bucket that is either a source or a destination in a replication rule. In replication, you have a source bucket on which you configure replication and destination bucket or buckets where Amazon S3 stores object replicas. When you request an object (GetObject) or object metadata (HeadObject) from these buckets, Amazon S3 will return the x-amz-replication-status header in the response as follows:    If requesting an object from the source bucket, Amazon S3 will return the x-amz-replication-status header if the object in your request is eligible for replication.  For example, suppose that in your replication configuration, you specify object prefix TaxDocs requesting Amazon S3 to replicate objects with key prefix TaxDocs. Any objects you upload with this key name prefix, for example TaxDocs/document1.pdf, are eligible for replication. For any object request with this key name prefix, Amazon S3 will return the x-amz-replication-status header with value PENDING, COMPLETED or FAILED indicating object replication status.    If requesting an object from a destination bucket, Amazon S3 will return the x-amz-replication-status header with value REPLICA if the object in your request is a replica that Amazon S3 created and there is no replica modification replication in progress.    When replicating objects to multiple destination buckets, the x-amz-replication-status header acts differently. The header of the source object will only return a value of COMPLETED when replication is successful to all destinations. The header will remain at value PENDING until replication has completed for all destinations. If one or more destinations fails replication the header will return FAILED.    For more information, see Replication.
     */
    ReplicationStatus?: ReplicationStatus
    /**
     * The count of parts this object has. This value is only returned if you specify partNumber in your request and the object was uploaded as a multipart upload.
     */
    PartsCount?: PartsCount
    /**
     * The Object Lock mode, if any, that's in effect for this object. This header is only returned if the requester has the s3:GetObjectRetention permission. For more information about S3 Object Lock, see Object Lock.
     */
    ObjectLockMode?: ObjectLockMode
    /**
     * The date and time when the Object Lock retention period expires. This header is only returned if the requester has the s3:GetObjectRetention permission.
     */
    ObjectLockRetainUntilDate?: ObjectLockRetainUntilDate
    /**
     * Specifies whether a legal hold is in effect for this object. This header is only returned if the requester has the s3:GetObjectLegalHold permission. This header is not returned if the specified version of this object has never had a legal hold applied. For more information about S3 Object Lock, see Object Lock.
     */
    ObjectLockLegalHoldStatus?: ObjectLockLegalHoldStatus
  }
  export interface HeadObjectRequest {
    /**
     * The name of the bucket containing the object. When using this action with an access point, you must direct requests to the access point hostname. The access point hostname takes the form AccessPointName-AccountId.s3-accesspoint.Region.amazonaws.com. When using this action with an access point through the Amazon Web Services SDKs, you provide the access point ARN in place of the bucket name. For more information about access point ARNs, see Using access points in the Amazon S3 User Guide. When using this action with Amazon S3 on Outposts, you must direct requests to the S3 on Outposts hostname. The S3 on Outposts hostname takes the form  AccessPointName-AccountId.outpostID.s3-outposts.Region.amazonaws.com. When using this action with S3 on Outposts through the Amazon Web Services SDKs, you provide the Outposts bucket ARN in place of the bucket name. For more information about S3 on Outposts ARNs, see Using Amazon S3 on Outposts in the Amazon S3 User Guide.
     */
    Bucket: BucketName
    /**
     * Return the object only if its entity tag (ETag) is the same as the one specified; otherwise, return a 412 (precondition failed) error.
     */
    IfMatch?: IfMatch
    /**
     * Return the object only if it has been modified since the specified time; otherwise, return a 304 (not modified) error.
     */
    IfModifiedSince?: IfModifiedSince
    /**
     * Return the object only if its entity tag (ETag) is different from the one specified; otherwise, return a 304 (not modified) error.
     */
    IfNoneMatch?: IfNoneMatch
    /**
     * Return the object only if it has not been modified since the specified time; otherwise, return a 412 (precondition failed) error.
     */
    IfUnmodifiedSince?: IfUnmodifiedSince
    /**
     * The object key.
     */
    Key: ObjectKey
    /**
     * Because HeadObject returns only the metadata for an object, this parameter has no effect.
     */
    Range?: Range
    /**
     * VersionId used to reference a specific version of the object.
     */
    VersionId?: ObjectVersionId
    /**
     * Specifies the algorithm to use to when encrypting the object (for example, AES256).
     */
    SSECustomerAlgorithm?: SSECustomerAlgorithm
    /**
     * Specifies the customer-provided encryption key for Amazon S3 to use in encrypting data. This value is used to store the object and then it is discarded; Amazon S3 does not store the encryption key. The key must be appropriate for use with the algorithm specified in the x-amz-server-side-encryption-customer-algorithm header.
     */
    SSECustomerKey?: SSECustomerKey
    /**
     * Specifies the 128-bit MD5 digest of the encryption key according to RFC 1321. Amazon S3 uses this header for a message integrity check to ensure that the encryption key was transmitted without error.
     */
    SSECustomerKeyMD5?: SSECustomerKeyMD5
    RequestPayer?: RequestPayer
    /**
     * Part number of the object being read. This is a positive integer between 1 and 10,000. Effectively performs a 'ranged' HEAD request for the part specified. Useful querying about the size of the part and the number of parts in this object.
     */
    PartNumber?: PartNumber
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
    /**
     * To retrieve the checksum, this parameter must be enabled. In addition, if you enable ChecksumMode and the object is encrypted with Amazon Web Services Key Management Service (Amazon Web Services KMS), you must have permission to use the kms:Decrypt action for the request to succeed.
     */
    ChecksumMode?: ChecksumMode
  }
  export type HostName = string
  export type HttpErrorCodeReturnedEquals = string
  export type HttpRedirectCode = string
  export type ID = string
  export type IfMatch = string
  export type IfModifiedSince = Date
  export type IfNoneMatch = string
  export type IfUnmodifiedSince = Date
  export interface IndexDocument {
    /**
     * A suffix that is appended to a request that is for a directory on the website endpoint (for example,if the suffix is index.html and you make a request to samplebucket/images/ the data that is returned will be for the object with the key name images/index.html) The suffix must not be empty and must not include a slash character.  Replacement must be made for object keys containing special characters (such as carriage returns) when using XML requests. For more information, see  XML related object key constraints.
     */
    Suffix: Suffix
  }
  export type Initiated = Date
  export interface Initiator {
    /**
     * If the principal is an Amazon Web Services account, it provides the Canonical User ID. If the principal is an IAM User, it provides a user ARN value.
     */
    ID?: ID
    /**
     * Name of the Principal.
     */
    DisplayName?: DisplayName
  }
  export interface InputSerialization {
    /**
     * Describes the serialization of a CSV-encoded object.
     */
    CSV?: CSVInput
    /**
     * Specifies object's compression format. Valid values: NONE, GZIP, BZIP2. Default Value: NONE.
     */
    CompressionType?: CompressionType
    /**
     * Specifies JSON as object's input serialization format.
     */
    JSON?: JSONInput
    /**
     * Specifies Parquet as object's input serialization format.
     */
    Parquet?: ParquetInput
  }
  export type IntelligentTieringAccessTier =
    | 'ARCHIVE_ACCESS'
    | 'DEEP_ARCHIVE_ACCESS'
    | string
  export interface IntelligentTieringAndOperator {
    /**
     * An object key name prefix that identifies the subset of objects to which the configuration applies.
     */
    Prefix?: Prefix
    /**
     * All of these tags must exist in the object's tag set in order for the configuration to apply.
     */
    Tags?: TagSet
  }
  export interface IntelligentTieringConfiguration {
    /**
     * The ID used to identify the S3 Intelligent-Tiering configuration.
     */
    Id: IntelligentTieringId
    /**
     * Specifies a bucket filter. The configuration only includes objects that meet the filter's criteria.
     */
    Filter?: IntelligentTieringFilter
    /**
     * Specifies the status of the configuration.
     */
    Status: IntelligentTieringStatus
    /**
     * Specifies the S3 Intelligent-Tiering storage class tier of the configuration.
     */
    Tierings: TieringList
  }
  export type IntelligentTieringConfigurationList =
    IntelligentTieringConfiguration[]
  export type IntelligentTieringDays = number
  export interface IntelligentTieringFilter {
    /**
     * An object key name prefix that identifies the subset of objects to which the rule applies.  Replacement must be made for object keys containing special characters (such as carriage returns) when using XML requests. For more information, see  XML related object key constraints.
     */
    Prefix?: Prefix
    Tag?: Tag
    /**
     * A conjunction (logical AND) of predicates, which is used in evaluating a metrics filter. The operator must have at least two predicates, and an object must match all of the predicates in order for the filter to apply.
     */
    And?: IntelligentTieringAndOperator
  }
  export type IntelligentTieringId = string
  export type IntelligentTieringStatus = 'Enabled' | 'Disabled' | string
  export interface InventoryConfiguration {
    /**
     * Contains information about where to publish the inventory results.
     */
    Destination: InventoryDestination
    /**
     * Specifies whether the inventory is enabled or disabled. If set to True, an inventory list is generated. If set to False, no inventory list is generated.
     */
    IsEnabled: IsEnabled
    /**
     * Specifies an inventory filter. The inventory only includes objects that meet the filter's criteria.
     */
    Filter?: InventoryFilter
    /**
     * The ID used to identify the inventory configuration.
     */
    Id: InventoryId
    /**
     * Object versions to include in the inventory list. If set to All, the list includes all the object versions, which adds the version-related fields VersionId, IsLatest, and DeleteMarker to the list. If set to Current, the list does not contain these version-related fields.
     */
    IncludedObjectVersions: InventoryIncludedObjectVersions
    /**
     * Contains the optional fields that are included in the inventory results.
     */
    OptionalFields?: InventoryOptionalFields
    /**
     * Specifies the schedule for generating inventory results.
     */
    Schedule: InventorySchedule
  }
  export type InventoryConfigurationList = InventoryConfiguration[]
  export interface InventoryDestination {
    /**
     * Contains the bucket name, file format, bucket owner (optional), and prefix (optional) where inventory results are published.
     */
    S3BucketDestination: InventoryS3BucketDestination
  }
  export interface InventoryEncryption {
    /**
     * Specifies the use of SSE-S3 to encrypt delivered inventory reports.
     */
    SSES3?: SSES3
    /**
     * Specifies the use of SSE-KMS to encrypt delivered inventory reports.
     */
    SSEKMS?: SSEKMS
  }
  export interface InventoryFilter {
    /**
     * The prefix that an object must have to be included in the inventory results.
     */
    Prefix: Prefix
  }
  export type InventoryFormat = 'CSV' | 'ORC' | 'Parquet' | string
  export type InventoryFrequency = 'Daily' | 'Weekly' | string
  export type InventoryId = string
  export type InventoryIncludedObjectVersions = 'All' | 'Current' | string
  export type InventoryOptionalField =
    | 'Size'
    | 'LastModifiedDate'
    | 'StorageClass'
    | 'ETag'
    | 'IsMultipartUploaded'
    | 'ReplicationStatus'
    | 'EncryptionStatus'
    | 'ObjectLockRetainUntilDate'
    | 'ObjectLockMode'
    | 'ObjectLockLegalHoldStatus'
    | 'IntelligentTieringAccessTier'
    | 'BucketKeyStatus'
    | 'ChecksumAlgorithm'
    | string
  export type InventoryOptionalFields = InventoryOptionalField[]
  export interface InventoryS3BucketDestination {
    /**
     * The account ID that owns the destination S3 bucket. If no account ID is provided, the owner is not validated before exporting data.    Although this value is optional, we strongly recommend that you set it to help prevent problems if the destination bucket ownership changes.
     */
    AccountId?: AccountId
    /**
     * The Amazon Resource Name (ARN) of the bucket where inventory results will be published.
     */
    Bucket: BucketName
    /**
     * Specifies the output format of the inventory results.
     */
    Format: InventoryFormat
    /**
     * The prefix that is prepended to all inventory results.
     */
    Prefix?: Prefix
    /**
     * Contains the type of server-side encryption used to encrypt the inventory results.
     */
    Encryption?: InventoryEncryption
  }
  export interface InventorySchedule {
    /**
     * Specifies how frequently inventory results are produced.
     */
    Frequency: InventoryFrequency
  }
  export type IsEnabled = boolean
  export type IsLatest = boolean
  export type IsPublic = boolean
  export type IsTruncated = boolean
  export interface JSONInput {
    /**
     * The type of JSON. Valid values: Document, Lines.
     */
    Type?: JSONType
  }
  export interface JSONOutput {
    /**
     * The value used to separate individual records in the output. If no value is specified, Amazon S3 uses a newline character ('\n').
     */
    RecordDelimiter?: RecordDelimiter
  }
  export type JSONType = 'DOCUMENT' | 'LINES' | string
  export type KMSContext = string
  export type KeyCount = number
  export type KeyMarker = string
  export type KeyPrefixEquals = string
  export type LambdaFunctionArn = string
  export interface LambdaFunctionConfiguration {
    Id?: NotificationId
    /**
     * The Amazon Resource Name (ARN) of the Lambda function that Amazon S3 invokes when the specified event type occurs.
     */
    LambdaFunctionArn: LambdaFunctionArn
    /**
     * The Amazon S3 bucket event for which to invoke the Lambda function. For more information, see Supported Event Types in the Amazon S3 User Guide.
     */
    Events: EventList
    Filter?: NotificationConfigurationFilter
  }
  export type LambdaFunctionConfigurationList = LambdaFunctionConfiguration[]
  export type LastModified = Date
  export interface LifecycleConfiguration {
    /**
     * Specifies lifecycle configuration rules for an Amazon S3 bucket.
     */
    Rules: Rules
  }
  export interface LifecycleExpiration {
    /**
     * Indicates at what date the object is to be moved or deleted. Should be in GMT ISO 8601 Format.
     */
    Date?: _Date
    /**
     * Indicates the lifetime, in days, of the objects that are subject to the rule. The value must be a non-zero positive integer.
     */
    Days?: Days
    /**
     * Indicates whether Amazon S3 will remove a delete marker with no noncurrent versions. If set to true, the delete marker will be expired; if set to false the policy takes no action. This cannot be specified with Days or Date in a Lifecycle Expiration Policy.
     */
    ExpiredObjectDeleteMarker?: ExpiredObjectDeleteMarker
  }
  export interface LifecycleRule {
    /**
     * Specifies the expiration for the lifecycle of the object in the form of date, days and, whether the object has a delete marker.
     */
    Expiration?: LifecycleExpiration
    /**
     * Unique identifier for the rule. The value cannot be longer than 255 characters.
     */
    ID?: ID
    /**
     * Prefix identifying one or more objects to which the rule applies. This is no longer used; use Filter instead.  Replacement must be made for object keys containing special characters (such as carriage returns) when using XML requests. For more information, see  XML related object key constraints.
     */
    Prefix?: Prefix
    /**
     * The Filter is used to identify objects that a Lifecycle Rule applies to. A Filter must have exactly one of Prefix, Tag, or And specified. Filter is required if the LifecycleRule does not contain a Prefix element.
     */
    Filter?: LifecycleRuleFilter
    /**
     * If 'Enabled', the rule is currently being applied. If 'Disabled', the rule is not currently being applied.
     */
    Status: ExpirationStatus
    /**
     * Specifies when an Amazon S3 object transitions to a specified storage class.
     */
    Transitions?: TransitionList
    /**
     *  Specifies the transition rule for the lifecycle rule that describes when noncurrent objects transition to a specific storage class. If your bucket is versioning-enabled (or versioning is suspended), you can set this action to request that Amazon S3 transition noncurrent object versions to a specific storage class at a set period in the object's lifetime.
     */
    NoncurrentVersionTransitions?: NoncurrentVersionTransitionList
    NoncurrentVersionExpiration?: NoncurrentVersionExpiration
    AbortIncompleteMultipartUpload?: AbortIncompleteMultipartUpload
  }
  export interface LifecycleRuleAndOperator {
    /**
     * Prefix identifying one or more objects to which the rule applies.
     */
    Prefix?: Prefix
    /**
     * All of these tags must exist in the object's tag set in order for the rule to apply.
     */
    Tags?: TagSet
    /**
     * Minimum object size to which the rule applies.
     */
    ObjectSizeGreaterThan?: ObjectSizeGreaterThanBytes
    /**
     * Maximum object size to which the rule applies.
     */
    ObjectSizeLessThan?: ObjectSizeLessThanBytes
  }
  export interface LifecycleRuleFilter {
    /**
     * Prefix identifying one or more objects to which the rule applies.  Replacement must be made for object keys containing special characters (such as carriage returns) when using XML requests. For more information, see  XML related object key constraints.
     */
    Prefix?: Prefix
    /**
     * This tag must exist in the object's tag set in order for the rule to apply.
     */
    Tag?: Tag
    /**
     * Minimum object size to which the rule applies.
     */
    ObjectSizeGreaterThan?: ObjectSizeGreaterThanBytes
    /**
     * Maximum object size to which the rule applies.
     */
    ObjectSizeLessThan?: ObjectSizeLessThanBytes
    And?: LifecycleRuleAndOperator
  }
  export type LifecycleRules = LifecycleRule[]
  export interface ListBucketAnalyticsConfigurationsOutput {
    /**
     * Indicates whether the returned list of analytics configurations is complete. A value of true indicates that the list is not complete and the NextContinuationToken will be provided for a subsequent request.
     */
    IsTruncated?: IsTruncated
    /**
     * The marker that is used as a starting point for this analytics configuration list response. This value is present if it was sent in the request.
     */
    ContinuationToken?: Token
    /**
     *  NextContinuationToken is sent when isTruncated is true, which indicates that there are more analytics configurations to list. The next request must include this NextContinuationToken. The token is obfuscated and is not a usable value.
     */
    NextContinuationToken?: NextToken
    /**
     * The list of analytics configurations for a bucket.
     */
    AnalyticsConfigurationList?: AnalyticsConfigurationList
  }
  export interface ListBucketAnalyticsConfigurationsRequest {
    /**
     * The name of the bucket from which analytics configurations are retrieved.
     */
    Bucket: BucketName
    /**
     * The ContinuationToken that represents a placeholder from where this request should begin.
     */
    ContinuationToken?: Token
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface ListBucketIntelligentTieringConfigurationsOutput {
    /**
     * Indicates whether the returned list of analytics configurations is complete. A value of true indicates that the list is not complete and the NextContinuationToken will be provided for a subsequent request.
     */
    IsTruncated?: IsTruncated
    /**
     * The ContinuationToken that represents a placeholder from where this request should begin.
     */
    ContinuationToken?: Token
    /**
     * The marker used to continue this inventory configuration listing. Use the NextContinuationToken from this response to continue the listing in a subsequent request. The continuation token is an opaque value that Amazon S3 understands.
     */
    NextContinuationToken?: NextToken
    /**
     * The list of S3 Intelligent-Tiering configurations for a bucket.
     */
    IntelligentTieringConfigurationList?: IntelligentTieringConfigurationList
  }
  export interface ListBucketIntelligentTieringConfigurationsRequest {
    /**
     * The name of the Amazon S3 bucket whose configuration you want to modify or retrieve.
     */
    Bucket: BucketName
    /**
     * The ContinuationToken that represents a placeholder from where this request should begin.
     */
    ContinuationToken?: Token
  }
  export interface ListBucketInventoryConfigurationsOutput {
    /**
     * If sent in the request, the marker that is used as a starting point for this inventory configuration list response.
     */
    ContinuationToken?: Token
    /**
     * The list of inventory configurations for a bucket.
     */
    InventoryConfigurationList?: InventoryConfigurationList
    /**
     * Tells whether the returned list of inventory configurations is complete. A value of true indicates that the list is not complete and the NextContinuationToken is provided for a subsequent request.
     */
    IsTruncated?: IsTruncated
    /**
     * The marker used to continue this inventory configuration listing. Use the NextContinuationToken from this response to continue the listing in a subsequent request. The continuation token is an opaque value that Amazon S3 understands.
     */
    NextContinuationToken?: NextToken
  }
  export interface ListBucketInventoryConfigurationsRequest {
    /**
     * The name of the bucket containing the inventory configurations to retrieve.
     */
    Bucket: BucketName
    /**
     * The marker used to continue an inventory configuration listing that has been truncated. Use the NextContinuationToken from a previously truncated list response to continue the listing. The continuation token is an opaque value that Amazon S3 understands.
     */
    ContinuationToken?: Token
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface ListBucketMetricsConfigurationsOutput {
    /**
     * Indicates whether the returned list of metrics configurations is complete. A value of true indicates that the list is not complete and the NextContinuationToken will be provided for a subsequent request.
     */
    IsTruncated?: IsTruncated
    /**
     * The marker that is used as a starting point for this metrics configuration list response. This value is present if it was sent in the request.
     */
    ContinuationToken?: Token
    /**
     * The marker used to continue a metrics configuration listing that has been truncated. Use the NextContinuationToken from a previously truncated list response to continue the listing. The continuation token is an opaque value that Amazon S3 understands.
     */
    NextContinuationToken?: NextToken
    /**
     * The list of metrics configurations for a bucket.
     */
    MetricsConfigurationList?: MetricsConfigurationList
  }
  export interface ListBucketMetricsConfigurationsRequest {
    /**
     * The name of the bucket containing the metrics configurations to retrieve.
     */
    Bucket: BucketName
    /**
     * The marker that is used to continue a metrics configuration listing that has been truncated. Use the NextContinuationToken from a previously truncated list response to continue the listing. The continuation token is an opaque value that Amazon S3 understands.
     */
    ContinuationToken?: Token
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface ListBucketsOutput {
    /**
     * The list of buckets owned by the requester.
     */
    Buckets?: Buckets
    /**
     * The owner of the buckets listed.
     */
    Owner?: Owner
  }
  export interface ListMultipartUploadsOutput {
    /**
     * The name of the bucket to which the multipart upload was initiated. Does not return the access point ARN or access point alias if used.
     */
    Bucket?: BucketName
    /**
     * The key at or after which the listing began.
     */
    KeyMarker?: KeyMarker
    /**
     * Upload ID after which listing began.
     */
    UploadIdMarker?: UploadIdMarker
    /**
     * When a list is truncated, this element specifies the value that should be used for the key-marker request parameter in a subsequent request.
     */
    NextKeyMarker?: NextKeyMarker
    /**
     * When a prefix is provided in the request, this field contains the specified prefix. The result contains only keys starting with the specified prefix.
     */
    Prefix?: Prefix
    /**
     * Contains the delimiter you specified in the request. If you don't specify a delimiter in your request, this element is absent from the response.
     */
    Delimiter?: Delimiter
    /**
     * When a list is truncated, this element specifies the value that should be used for the upload-id-marker request parameter in a subsequent request.
     */
    NextUploadIdMarker?: NextUploadIdMarker
    /**
     * Maximum number of multipart uploads that could have been included in the response.
     */
    MaxUploads?: MaxUploads
    /**
     * Indicates whether the returned list of multipart uploads is truncated. A value of true indicates that the list was truncated. The list can be truncated if the number of multipart uploads exceeds the limit allowed or specified by max uploads.
     */
    IsTruncated?: IsTruncated
    /**
     * Container for elements related to a particular multipart upload. A response can contain zero or more Upload elements.
     */
    Uploads?: MultipartUploadList
    /**
     * If you specify a delimiter in the request, then the result returns each distinct key prefix containing the delimiter in a CommonPrefixes element. The distinct key prefixes are returned in the Prefix child element.
     */
    CommonPrefixes?: CommonPrefixList
    /**
     * Encoding type used by Amazon S3 to encode object keys in the response. If you specify encoding-type request parameter, Amazon S3 includes this element in the response, and returns encoded key name values in the following response elements:  Delimiter, KeyMarker, Prefix, NextKeyMarker, Key.
     */
    EncodingType?: EncodingType
  }
  export interface ListMultipartUploadsRequest {
    /**
     * The name of the bucket to which the multipart upload was initiated.  When using this action with an access point, you must direct requests to the access point hostname. The access point hostname takes the form AccessPointName-AccountId.s3-accesspoint.Region.amazonaws.com. When using this action with an access point through the Amazon Web Services SDKs, you provide the access point ARN in place of the bucket name. For more information about access point ARNs, see Using access points in the Amazon S3 User Guide. When using this action with Amazon S3 on Outposts, you must direct requests to the S3 on Outposts hostname. The S3 on Outposts hostname takes the form  AccessPointName-AccountId.outpostID.s3-outposts.Region.amazonaws.com. When using this action with S3 on Outposts through the Amazon Web Services SDKs, you provide the Outposts bucket ARN in place of the bucket name. For more information about S3 on Outposts ARNs, see Using Amazon S3 on Outposts in the Amazon S3 User Guide.
     */
    Bucket: BucketName
    /**
     * Character you use to group keys. All keys that contain the same string between the prefix, if specified, and the first occurrence of the delimiter after the prefix are grouped under a single result element, CommonPrefixes. If you don't specify the prefix parameter, then the substring starts at the beginning of the key. The keys that are grouped under CommonPrefixes result element are not returned elsewhere in the response.
     */
    Delimiter?: Delimiter
    EncodingType?: EncodingType
    /**
     * Together with upload-id-marker, this parameter specifies the multipart upload after which listing should begin. If upload-id-marker is not specified, only the keys lexicographically greater than the specified key-marker will be included in the list. If upload-id-marker is specified, any multipart uploads for a key equal to the key-marker might also be included, provided those multipart uploads have upload IDs lexicographically greater than the specified upload-id-marker.
     */
    KeyMarker?: KeyMarker
    /**
     * Sets the maximum number of multipart uploads, from 1 to 1,000, to return in the response body. 1,000 is the maximum number of uploads that can be returned in a response.
     */
    MaxUploads?: MaxUploads
    /**
     * Lists in-progress uploads only for those keys that begin with the specified prefix. You can use prefixes to separate a bucket into different grouping of keys. (You can think of using prefix to make groups in the same way you'd use a folder in a file system.)
     */
    Prefix?: Prefix
    /**
     * Together with key-marker, specifies the multipart upload after which listing should begin. If key-marker is not specified, the upload-id-marker parameter is ignored. Otherwise, any multipart uploads for a key equal to the key-marker might be included in the list only if they have an upload ID lexicographically greater than the specified upload-id-marker.
     */
    UploadIdMarker?: UploadIdMarker
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface ListObjectVersionsOutput {
    /**
     * A flag that indicates whether Amazon S3 returned all of the results that satisfied the search criteria. If your results were truncated, you can make a follow-up paginated request using the NextKeyMarker and NextVersionIdMarker response parameters as a starting place in another request to return the rest of the results.
     */
    IsTruncated?: IsTruncated
    /**
     * Marks the last key returned in a truncated response.
     */
    KeyMarker?: KeyMarker
    /**
     * Marks the last version of the key returned in a truncated response.
     */
    VersionIdMarker?: VersionIdMarker
    /**
     * When the number of responses exceeds the value of MaxKeys, NextKeyMarker specifies the first key not returned that satisfies the search criteria. Use this value for the key-marker request parameter in a subsequent request.
     */
    NextKeyMarker?: NextKeyMarker
    /**
     * When the number of responses exceeds the value of MaxKeys, NextVersionIdMarker specifies the first object version not returned that satisfies the search criteria. Use this value for the version-id-marker request parameter in a subsequent request.
     */
    NextVersionIdMarker?: NextVersionIdMarker
    /**
     * Container for version information.
     */
    Versions?: ObjectVersionList
    /**
     * Container for an object that is a delete marker.
     */
    DeleteMarkers?: DeleteMarkers
    /**
     * The bucket name.
     */
    Name?: BucketName
    /**
     * Selects objects that start with the value supplied by this parameter.
     */
    Prefix?: Prefix
    /**
     * The delimiter grouping the included keys. A delimiter is a character that you specify to group keys. All keys that contain the same string between the prefix and the first occurrence of the delimiter are grouped under a single result element in CommonPrefixes. These groups are counted as one result against the max-keys limitation. These keys are not returned elsewhere in the response.
     */
    Delimiter?: Delimiter
    /**
     * Specifies the maximum number of objects to return.
     */
    MaxKeys?: MaxKeys
    /**
     * All of the keys rolled up into a common prefix count as a single return when calculating the number of returns.
     */
    CommonPrefixes?: CommonPrefixList
    /**
     *  Encoding type used by Amazon S3 to encode object key names in the XML response. If you specify encoding-type request parameter, Amazon S3 includes this element in the response, and returns encoded key name values in the following response elements:  KeyMarker, NextKeyMarker, Prefix, Key, and Delimiter.
     */
    EncodingType?: EncodingType
  }
  export interface ListObjectVersionsRequest {
    /**
     * The bucket name that contains the objects.
     */
    Bucket: BucketName
    /**
     * A delimiter is a character that you specify to group keys. All keys that contain the same string between the prefix and the first occurrence of the delimiter are grouped under a single result element in CommonPrefixes. These groups are counted as one result against the max-keys limitation. These keys are not returned elsewhere in the response.
     */
    Delimiter?: Delimiter
    EncodingType?: EncodingType
    /**
     * Specifies the key to start with when listing objects in a bucket.
     */
    KeyMarker?: KeyMarker
    /**
     * Sets the maximum number of keys returned in the response. By default the action returns up to 1,000 key names. The response might contain fewer keys but will never contain more. If additional keys satisfy the search criteria, but were not returned because max-keys was exceeded, the response contains &lt;isTruncated&gt;true&lt;/isTruncated&gt;. To return the additional keys, see key-marker and version-id-marker.
     */
    MaxKeys?: MaxKeys
    /**
     * Use this parameter to select only those keys that begin with the specified prefix. You can use prefixes to separate a bucket into different groupings of keys. (You can think of using prefix to make groups in the same way you'd use a folder in a file system.) You can use prefix with delimiter to roll up numerous objects into a single result under CommonPrefixes.
     */
    Prefix?: Prefix
    /**
     * Specifies the object version you want to start listing from.
     */
    VersionIdMarker?: VersionIdMarker
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface ListObjectsOutput {
    /**
     * A flag that indicates whether Amazon S3 returned all of the results that satisfied the search criteria.
     */
    IsTruncated?: IsTruncated
    /**
     * Indicates where in the bucket listing begins. Marker is included in the response if it was sent with the request.
     */
    Marker?: Marker
    /**
     * When response is truncated (the IsTruncated element value in the response is true), you can use the key name in this field as marker in the subsequent request to get next set of objects. Amazon S3 lists objects in alphabetical order Note: This element is returned only if you have delimiter request parameter specified. If response does not include the NextMarker and it is truncated, you can use the value of the last Key in the response as the marker in the subsequent request to get the next set of object keys.
     */
    NextMarker?: NextMarker
    /**
     * Metadata about each object returned.
     */
    Contents?: ObjectList
    /**
     * The bucket name.
     */
    Name?: BucketName
    /**
     * Keys that begin with the indicated prefix.
     */
    Prefix?: Prefix
    /**
     * Causes keys that contain the same string between the prefix and the first occurrence of the delimiter to be rolled up into a single result element in the CommonPrefixes collection. These rolled-up keys are not returned elsewhere in the response. Each rolled-up result counts as only one return against the MaxKeys value.
     */
    Delimiter?: Delimiter
    /**
     * The maximum number of keys returned in the response body.
     */
    MaxKeys?: MaxKeys
    /**
     * All of the keys (up to 1,000) rolled up in a common prefix count as a single return when calculating the number of returns.  A response can contain CommonPrefixes only if you specify a delimiter. CommonPrefixes contains all (if there are any) keys between Prefix and the next occurrence of the string specified by the delimiter.  CommonPrefixes lists keys that act like subdirectories in the directory specified by Prefix. For example, if the prefix is notes/ and the delimiter is a slash (/) as in notes/summer/july, the common prefix is notes/summer/. All of the keys that roll up into a common prefix count as a single return when calculating the number of returns.
     */
    CommonPrefixes?: CommonPrefixList
    /**
     * Encoding type used by Amazon S3 to encode object keys in the response.
     */
    EncodingType?: EncodingType
  }
  export interface ListObjectsRequest {
    /**
     * The name of the bucket containing the objects. When using this action with an access point, you must direct requests to the access point hostname. The access point hostname takes the form AccessPointName-AccountId.s3-accesspoint.Region.amazonaws.com. When using this action with an access point through the Amazon Web Services SDKs, you provide the access point ARN in place of the bucket name. For more information about access point ARNs, see Using access points in the Amazon S3 User Guide. When using this action with Amazon S3 on Outposts, you must direct requests to the S3 on Outposts hostname. The S3 on Outposts hostname takes the form  AccessPointName-AccountId.outpostID.s3-outposts.Region.amazonaws.com. When using this action with S3 on Outposts through the Amazon Web Services SDKs, you provide the Outposts bucket ARN in place of the bucket name. For more information about S3 on Outposts ARNs, see Using Amazon S3 on Outposts in the Amazon S3 User Guide.
     */
    Bucket: BucketName
    /**
     * A delimiter is a character you use to group keys.
     */
    Delimiter?: Delimiter
    EncodingType?: EncodingType
    /**
     * Marker is where you want Amazon S3 to start listing from. Amazon S3 starts listing after this specified key. Marker can be any key in the bucket.
     */
    Marker?: Marker
    /**
     * Sets the maximum number of keys returned in the response. By default the action returns up to 1,000 key names. The response might contain fewer keys but will never contain more.
     */
    MaxKeys?: MaxKeys
    /**
     * Limits the response to keys that begin with the specified prefix.
     */
    Prefix?: Prefix
    /**
     * Confirms that the requester knows that she or he will be charged for the list objects request. Bucket owners need not specify this parameter in their requests.
     */
    RequestPayer?: RequestPayer
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface ListObjectsV2Output {
    /**
     * Set to false if all of the results were returned. Set to true if more keys are available to return. If the number of results exceeds that specified by MaxKeys, all of the results might not be returned.
     */
    IsTruncated?: IsTruncated
    /**
     * Metadata about each object returned.
     */
    Contents?: ObjectList
    /**
     * The bucket name. When using this action with an access point, you must direct requests to the access point hostname. The access point hostname takes the form AccessPointName-AccountId.s3-accesspoint.Region.amazonaws.com. When using this action with an access point through the Amazon Web Services SDKs, you provide the access point ARN in place of the bucket name. For more information about access point ARNs, see Using access points in the Amazon S3 User Guide. When using this action with Amazon S3 on Outposts, you must direct requests to the S3 on Outposts hostname. The S3 on Outposts hostname takes the form  AccessPointName-AccountId.outpostID.s3-outposts.Region.amazonaws.com. When using this action with S3 on Outposts through the Amazon Web Services SDKs, you provide the Outposts bucket ARN in place of the bucket name. For more information about S3 on Outposts ARNs, see Using Amazon S3 on Outposts in the Amazon S3 User Guide.
     */
    Name?: BucketName
    /**
     *  Keys that begin with the indicated prefix.
     */
    Prefix?: Prefix
    /**
     * Causes keys that contain the same string between the prefix and the first occurrence of the delimiter to be rolled up into a single result element in the CommonPrefixes collection. These rolled-up keys are not returned elsewhere in the response. Each rolled-up result counts as only one return against the MaxKeys value.
     */
    Delimiter?: Delimiter
    /**
     * Sets the maximum number of keys returned in the response. By default the action returns up to 1,000 key names. The response might contain fewer keys but will never contain more.
     */
    MaxKeys?: MaxKeys
    /**
     * All of the keys (up to 1,000) rolled up into a common prefix count as a single return when calculating the number of returns. A response can contain CommonPrefixes only if you specify a delimiter.  CommonPrefixes contains all (if there are any) keys between Prefix and the next occurrence of the string specified by a delimiter.  CommonPrefixes lists keys that act like subdirectories in the directory specified by Prefix. For example, if the prefix is notes/ and the delimiter is a slash (/) as in notes/summer/july, the common prefix is notes/summer/. All of the keys that roll up into a common prefix count as a single return when calculating the number of returns.
     */
    CommonPrefixes?: CommonPrefixList
    /**
     * Encoding type used by Amazon S3 to encode object key names in the XML response. If you specify the encoding-type request parameter, Amazon S3 includes this element in the response, and returns encoded key name values in the following response elements:  Delimiter, Prefix, Key, and StartAfter.
     */
    EncodingType?: EncodingType
    /**
     * KeyCount is the number of keys returned with this request. KeyCount will always be less than or equals to MaxKeys field. Say you ask for 50 keys, your result will include less than equals 50 keys
     */
    KeyCount?: KeyCount
    /**
     *  If ContinuationToken was sent with the request, it is included in the response.
     */
    ContinuationToken?: Token
    /**
     *  NextContinuationToken is sent when isTruncated is true, which means there are more keys in the bucket that can be listed. The next list requests to Amazon S3 can be continued with this NextContinuationToken. NextContinuationToken is obfuscated and is not a real key
     */
    NextContinuationToken?: NextToken
    /**
     * If StartAfter was sent with the request, it is included in the response.
     */
    StartAfter?: StartAfter
  }
  export interface ListObjectsV2Request {
    /**
     * Bucket name to list.  When using this action with an access point, you must direct requests to the access point hostname. The access point hostname takes the form AccessPointName-AccountId.s3-accesspoint.Region.amazonaws.com. When using this action with an access point through the Amazon Web Services SDKs, you provide the access point ARN in place of the bucket name. For more information about access point ARNs, see Using access points in the Amazon S3 User Guide. When using this action with Amazon S3 on Outposts, you must direct requests to the S3 on Outposts hostname. The S3 on Outposts hostname takes the form  AccessPointName-AccountId.outpostID.s3-outposts.Region.amazonaws.com. When using this action with S3 on Outposts through the Amazon Web Services SDKs, you provide the Outposts bucket ARN in place of the bucket name. For more information about S3 on Outposts ARNs, see Using Amazon S3 on Outposts in the Amazon S3 User Guide.
     */
    Bucket: BucketName
    /**
     * A delimiter is a character you use to group keys.
     */
    Delimiter?: Delimiter
    /**
     * Encoding type used by Amazon S3 to encode object keys in the response.
     */
    EncodingType?: EncodingType
    /**
     * Sets the maximum number of keys returned in the response. By default the action returns up to 1,000 key names. The response might contain fewer keys but will never contain more.
     */
    MaxKeys?: MaxKeys
    /**
     * Limits the response to keys that begin with the specified prefix.
     */
    Prefix?: Prefix
    /**
     * ContinuationToken indicates Amazon S3 that the list is being continued on this bucket with a token. ContinuationToken is obfuscated and is not a real key.
     */
    ContinuationToken?: Token
    /**
     * The owner field is not present in listV2 by default, if you want to return owner field with each key in the result then set the fetch owner field to true.
     */
    FetchOwner?: FetchOwner
    /**
     * StartAfter is where you want Amazon S3 to start listing from. Amazon S3 starts listing after this specified key. StartAfter can be any key in the bucket.
     */
    StartAfter?: StartAfter
    /**
     * Confirms that the requester knows that she or he will be charged for the list objects request in V2 style. Bucket owners need not specify this parameter in their requests.
     */
    RequestPayer?: RequestPayer
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface ListPartsOutput {
    /**
     * If the bucket has a lifecycle rule configured with an action to abort incomplete multipart uploads and the prefix in the lifecycle rule matches the object name in the request, then the response includes this header indicating when the initiated multipart upload will become eligible for abort operation. For more information, see Aborting Incomplete Multipart Uploads Using a Bucket Lifecycle Policy. The response will also include the x-amz-abort-rule-id header that will provide the ID of the lifecycle configuration rule that defines this action.
     */
    AbortDate?: AbortDate
    /**
     * This header is returned along with the x-amz-abort-date header. It identifies applicable lifecycle configuration rule that defines the action to abort incomplete multipart uploads.
     */
    AbortRuleId?: AbortRuleId
    /**
     * The name of the bucket to which the multipart upload was initiated. Does not return the access point ARN or access point alias if used.
     */
    Bucket?: BucketName
    /**
     * Object key for which the multipart upload was initiated.
     */
    Key?: ObjectKey
    /**
     * Upload ID identifying the multipart upload whose parts are being listed.
     */
    UploadId?: MultipartUploadId
    /**
     * When a list is truncated, this element specifies the last part in the list, as well as the value to use for the part-number-marker request parameter in a subsequent request.
     */
    PartNumberMarker?: PartNumberMarker
    /**
     * When a list is truncated, this element specifies the last part in the list, as well as the value to use for the part-number-marker request parameter in a subsequent request.
     */
    NextPartNumberMarker?: NextPartNumberMarker
    /**
     * Maximum number of parts that were allowed in the response.
     */
    MaxParts?: MaxParts
    /**
     *  Indicates whether the returned list of parts is truncated. A true value indicates that the list was truncated. A list can be truncated if the number of parts exceeds the limit returned in the MaxParts element.
     */
    IsTruncated?: IsTruncated
    /**
     *  Container for elements related to a particular part. A response can contain zero or more Part elements.
     */
    Parts?: Parts
    /**
     * Container element that identifies who initiated the multipart upload. If the initiator is an Amazon Web Services account, this element provides the same information as the Owner element. If the initiator is an IAM User, this element provides the user ARN and display name.
     */
    Initiator?: Initiator
    /**
     *  Container element that identifies the object owner, after the object is created. If multipart upload is initiated by an IAM user, this element provides the parent account ID and display name.
     */
    Owner?: Owner
    /**
     * Class of storage (STANDARD or REDUCED_REDUNDANCY) used to store the uploaded object.
     */
    StorageClass?: StorageClass
    RequestCharged?: RequestCharged
    /**
     * The algorithm that was used to create a checksum of the object.
     */
    ChecksumAlgorithm?: ChecksumAlgorithm
  }
  export interface ListPartsRequest {
    /**
     * The name of the bucket to which the parts are being uploaded.  When using this action with an access point, you must direct requests to the access point hostname. The access point hostname takes the form AccessPointName-AccountId.s3-accesspoint.Region.amazonaws.com. When using this action with an access point through the Amazon Web Services SDKs, you provide the access point ARN in place of the bucket name. For more information about access point ARNs, see Using access points in the Amazon S3 User Guide. When using this action with Amazon S3 on Outposts, you must direct requests to the S3 on Outposts hostname. The S3 on Outposts hostname takes the form  AccessPointName-AccountId.outpostID.s3-outposts.Region.amazonaws.com. When using this action with S3 on Outposts through the Amazon Web Services SDKs, you provide the Outposts bucket ARN in place of the bucket name. For more information about S3 on Outposts ARNs, see Using Amazon S3 on Outposts in the Amazon S3 User Guide.
     */
    Bucket: BucketName
    /**
     * Object key for which the multipart upload was initiated.
     */
    Key: ObjectKey
    /**
     * Sets the maximum number of parts to return.
     */
    MaxParts?: MaxParts
    /**
     * Specifies the part after which listing should begin. Only parts with higher part numbers will be listed.
     */
    PartNumberMarker?: PartNumberMarker
    /**
     * Upload ID identifying the multipart upload whose parts are being listed.
     */
    UploadId: MultipartUploadId
    RequestPayer?: RequestPayer
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
    /**
     * The server-side encryption (SSE) algorithm used to encrypt the object. This parameter is needed only when the object was created using a checksum algorithm. For more information, see Protecting data using SSE-C keys in the Amazon S3 User Guide.
     */
    SSECustomerAlgorithm?: SSECustomerAlgorithm
    /**
     * The server-side encryption (SSE) customer managed key. This parameter is needed only when the object was created using a checksum algorithm. For more information, see Protecting data using SSE-C keys in the Amazon S3 User Guide.
     */
    SSECustomerKey?: SSECustomerKey
    /**
     * The MD5 server-side encryption (SSE) customer managed key. This parameter is needed only when the object was created using a checksum algorithm. For more information, see Protecting data using SSE-C keys in the Amazon S3 User Guide.
     */
    SSECustomerKeyMD5?: SSECustomerKeyMD5
  }
  export type Location = string
  export type LocationPrefix = string
  export interface LoggingEnabled {
    /**
     * Specifies the bucket where you want Amazon S3 to store server access logs. You can have your logs delivered to any bucket that you own, including the same bucket that is being logged. You can also configure multiple buckets to deliver their logs to the same target bucket. In this case, you should choose a different TargetPrefix for each source bucket so that the delivered log files can be distinguished by key.
     */
    TargetBucket: TargetBucket
    /**
     * Container for granting information. Buckets that use the bucket owner enforced setting for Object Ownership don't support target grants. For more information, see Permissions for server access log delivery in the Amazon S3 User Guide.
     */
    TargetGrants?: TargetGrants
    /**
     * A prefix for all log object keys. If you store log files from multiple Amazon S3 buckets in a single bucket, you can use a prefix to distinguish which log files came from which bucket.
     */
    TargetPrefix: TargetPrefix
  }
  export type MFA = string
  export type MFADelete = 'Enabled' | 'Disabled' | string
  export type MFADeleteStatus = 'Enabled' | 'Disabled' | string
  export type Marker = string
  export type MaxAgeSeconds = number
  export type MaxKeys = number
  export type MaxParts = number
  export type MaxUploads = number
  export type Message = string
  export type Metadata = { [key: string]: MetadataValue }
  export type MetadataDirective = 'COPY' | 'REPLACE' | string
  export interface MetadataEntry {
    /**
     * Name of the Object.
     */
    Name?: MetadataKey
    /**
     * Value of the Object.
     */
    Value?: MetadataValue
  }
  export type MetadataKey = string
  export type MetadataValue = string
  export interface Metrics {
    /**
     *  Specifies whether the replication metrics are enabled.
     */
    Status: MetricsStatus
    /**
     *  A container specifying the time threshold for emitting the s3:Replication:OperationMissedThreshold event.
     */
    EventThreshold?: ReplicationTimeValue
  }
  export interface MetricsAndOperator {
    /**
     * The prefix used when evaluating an AND predicate.
     */
    Prefix?: Prefix
    /**
     * The list of tags used when evaluating an AND predicate.
     */
    Tags?: TagSet
    /**
     * The access point ARN used when evaluating an AND predicate.
     */
    AccessPointArn?: AccessPointArn
  }
  export interface MetricsConfiguration {
    /**
     * The ID used to identify the metrics configuration.
     */
    Id: MetricsId
    /**
     * Specifies a metrics configuration filter. The metrics configuration will only include objects that meet the filter's criteria. A filter must be a prefix, an object tag, an access point ARN, or a conjunction (MetricsAndOperator).
     */
    Filter?: MetricsFilter
  }
  export type MetricsConfigurationList = MetricsConfiguration[]
  export interface MetricsFilter {
    /**
     * The prefix used when evaluating a metrics filter.
     */
    Prefix?: Prefix
    /**
     * The tag used when evaluating a metrics filter.
     */
    Tag?: Tag
    /**
     * The access point ARN used when evaluating a metrics filter.
     */
    AccessPointArn?: AccessPointArn
    /**
     * A conjunction (logical AND) of predicates, which is used in evaluating a metrics filter. The operator must have at least two predicates, and an object must match all of the predicates in order for the filter to apply.
     */
    And?: MetricsAndOperator
  }
  export type MetricsId = string
  export type MetricsStatus = 'Enabled' | 'Disabled' | string
  export type Minutes = number
  export type MissingMeta = number
  export interface MultipartUpload {
    /**
     * Upload ID that identifies the multipart upload.
     */
    UploadId?: MultipartUploadId
    /**
     * Key of the object for which the multipart upload was initiated.
     */
    Key?: ObjectKey
    /**
     * Date and time at which the multipart upload was initiated.
     */
    Initiated?: Initiated
    /**
     * The class of storage used to store the object.
     */
    StorageClass?: StorageClass
    /**
     * Specifies the owner of the object that is part of the multipart upload.
     */
    Owner?: Owner
    /**
     * Identifies who initiated the multipart upload.
     */
    Initiator?: Initiator
    /**
     * The algorithm that was used to create a checksum of the object.
     */
    ChecksumAlgorithm?: ChecksumAlgorithm
  }
  export type MultipartUploadId = string
  export type MultipartUploadList = MultipartUpload[]
  export type NextKeyMarker = string
  export type NextMarker = string
  export type NextPartNumberMarker = number
  export type NextToken = string
  export type NextUploadIdMarker = string
  export type NextVersionIdMarker = string
  export interface NoncurrentVersionExpiration {
    /**
     * Specifies the number of days an object is noncurrent before Amazon S3 can perform the associated action. The value must be a non-zero positive integer. For information about the noncurrent days calculations, see How Amazon S3 Calculates When an Object Became Noncurrent in the Amazon S3 User Guide.
     */
    NoncurrentDays?: Days
    /**
     * Specifies how many noncurrent versions Amazon S3 will retain. If there are this many more recent noncurrent versions, Amazon S3 will take the associated action. For more information about noncurrent versions, see Lifecycle configuration elements in the Amazon S3 User Guide.
     */
    NewerNoncurrentVersions?: VersionCount
  }
  export interface NoncurrentVersionTransition {
    /**
     * Specifies the number of days an object is noncurrent before Amazon S3 can perform the associated action. For information about the noncurrent days calculations, see How Amazon S3 Calculates How Long an Object Has Been Noncurrent in the Amazon S3 User Guide.
     */
    NoncurrentDays?: Days
    /**
     * The class of storage used to store the object.
     */
    StorageClass?: TransitionStorageClass
    /**
     * Specifies how many noncurrent versions Amazon S3 will retain. If there are this many more recent noncurrent versions, Amazon S3 will take the associated action. For more information about noncurrent versions, see Lifecycle configuration elements in the Amazon S3 User Guide.
     */
    NewerNoncurrentVersions?: VersionCount
  }
  export type NoncurrentVersionTransitionList = NoncurrentVersionTransition[]
  export interface NotificationConfiguration {
    /**
     * The topic to which notifications are sent and the events for which notifications are generated.
     */
    TopicConfigurations?: TopicConfigurationList
    /**
     * The Amazon Simple Queue Service queues to publish messages to and the events for which to publish messages.
     */
    QueueConfigurations?: QueueConfigurationList
    /**
     * Describes the Lambda functions to invoke and the events for which to invoke them.
     */
    LambdaFunctionConfigurations?: LambdaFunctionConfigurationList
    /**
     * Enables delivery of events to Amazon EventBridge.
     */
    EventBridgeConfiguration?: EventBridgeConfiguration
  }
  export interface NotificationConfigurationDeprecated {
    /**
     * This data type is deprecated. A container for specifying the configuration for publication of messages to an Amazon Simple Notification Service (Amazon SNS) topic when Amazon S3 detects specified events.
     */
    TopicConfiguration?: TopicConfigurationDeprecated
    /**
     * This data type is deprecated. This data type specifies the configuration for publishing messages to an Amazon Simple Queue Service (Amazon SQS) queue when Amazon S3 detects specified events.
     */
    QueueConfiguration?: QueueConfigurationDeprecated
    /**
     * Container for specifying the Lambda notification configuration.
     */
    CloudFunctionConfiguration?: CloudFunctionConfiguration
  }
  export interface NotificationConfigurationFilter {
    Key?: S3KeyFilter
  }
  export type NotificationId = string
  export interface Object {
    /**
     * The name that you assign to an object. You use the object key to retrieve the object.
     */
    Key?: ObjectKey
    /**
     * Creation date of the object.
     */
    LastModified?: LastModified
    /**
     * The entity tag is a hash of the object. The ETag reflects changes only to the contents of an object, not its metadata. The ETag may or may not be an MD5 digest of the object data. Whether or not it is depends on how the object was created and how it is encrypted as described below:   Objects created by the PUT Object, POST Object, or Copy operation, or through the Amazon Web Services Management Console, and are encrypted by SSE-S3 or plaintext, have ETags that are an MD5 digest of their object data.   Objects created by the PUT Object, POST Object, or Copy operation, or through the Amazon Web Services Management Console, and are encrypted by SSE-C or SSE-KMS, have ETags that are not an MD5 digest of their object data.   If an object is created by either the Multipart Upload or Part Copy operation, the ETag is not an MD5 digest, regardless of the method of encryption. If an object is larger than 16 MB, the Amazon Web Services Management Console will upload or copy that object as a Multipart Upload, and therefore the ETag will not be an MD5 digest.
     */
    ETag?: ETag
    /**
     * The algorithm that was used to create a checksum of the object.
     */
    ChecksumAlgorithm?: ChecksumAlgorithmList
    /**
     * Size in bytes of the object
     */
    Size?: Size
    /**
     * The class of storage used to store the object.
     */
    StorageClass?: ObjectStorageClass
    /**
     * The owner of the object
     */
    Owner?: Owner
  }
  export type ObjectAttributes =
    | 'ETag'
    | 'Checksum'
    | 'ObjectParts'
    | 'StorageClass'
    | 'ObjectSize'
    | string
  export type ObjectAttributesList = ObjectAttributes[]
  export type ObjectCannedACL =
    | 'private'
    | 'public-read'
    | 'public-read-write'
    | 'authenticated-read'
    | 'aws-exec-read'
    | 'bucket-owner-read'
    | 'bucket-owner-full-control'
    | string
  export interface ObjectIdentifier {
    /**
     * Key name of the object.  Replacement must be made for object keys containing special characters (such as carriage returns) when using XML requests. For more information, see  XML related object key constraints.
     */
    Key: ObjectKey
    /**
     * VersionId for the specific version of the object to delete.
     */
    VersionId?: ObjectVersionId
  }
  export type ObjectIdentifierList = ObjectIdentifier[]
  export type ObjectKey = string
  export type ObjectList = Object[]
  export interface ObjectLockConfiguration {
    /**
     * Indicates whether this bucket has an Object Lock configuration enabled. Enable ObjectLockEnabled when you apply ObjectLockConfiguration to a bucket.
     */
    ObjectLockEnabled?: ObjectLockEnabled
    /**
     * Specifies the Object Lock rule for the specified object. Enable the this rule when you apply ObjectLockConfiguration to a bucket. Bucket settings require both a mode and a period. The period can be either Days or Years but you must select one. You cannot specify Days and Years at the same time.
     */
    Rule?: ObjectLockRule
  }
  export type ObjectLockEnabled = 'Enabled' | string
  export type ObjectLockEnabledForBucket = boolean
  export interface ObjectLockLegalHold {
    /**
     * Indicates whether the specified object has a legal hold in place.
     */
    Status?: ObjectLockLegalHoldStatus
  }
  export type ObjectLockLegalHoldStatus = 'ON' | 'OFF' | string
  export type ObjectLockMode = 'GOVERNANCE' | 'COMPLIANCE' | string
  export type ObjectLockRetainUntilDate = Date
  export interface ObjectLockRetention {
    /**
     * Indicates the Retention mode for the specified object.
     */
    Mode?: ObjectLockRetentionMode
    /**
     * The date on which this Object Lock Retention will expire.
     */
    RetainUntilDate?: _Date
  }
  export type ObjectLockRetentionMode = 'GOVERNANCE' | 'COMPLIANCE' | string
  export interface ObjectLockRule {
    /**
     * The default Object Lock retention mode and period that you want to apply to new objects placed in the specified bucket. Bucket settings require both a mode and a period. The period can be either Days or Years but you must select one. You cannot specify Days and Years at the same time.
     */
    DefaultRetention?: DefaultRetention
  }
  export type ObjectLockToken = string
  export type ObjectOwnership =
    | 'BucketOwnerPreferred'
    | 'ObjectWriter'
    | 'BucketOwnerEnforced'
    | string
  export interface ObjectPart {
    /**
     * The part number identifying the part. This value is a positive integer between 1 and 10,000.
     */
    PartNumber?: PartNumber
    /**
     * The size of the uploaded part in bytes.
     */
    Size?: Size
    /**
     * This header can be used as a data integrity check to verify that the data received is the same data that was originally sent. This header specifies the base64-encoded, 32-bit CRC32 checksum of the object. For more information, see Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumCRC32?: ChecksumCRC32
    /**
     * The base64-encoded, 32-bit CRC32C checksum of the object. This will only be present if it was uploaded with the object. With multipart uploads, this may not be a checksum value of the object. For more information about how checksums are calculated with multipart uploads, see  Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumCRC32C?: ChecksumCRC32C
    /**
     * The base64-encoded, 160-bit SHA-1 digest of the object. This will only be present if it was uploaded with the object. With multipart uploads, this may not be a checksum value of the object. For more information about how checksums are calculated with multipart uploads, see  Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumSHA1?: ChecksumSHA1
    /**
     * The base64-encoded, 256-bit SHA-256 digest of the object. This will only be present if it was uploaded with the object. With multipart uploads, this may not be a checksum value of the object. For more information about how checksums are calculated with multipart uploads, see  Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumSHA256?: ChecksumSHA256
  }
  export type ObjectSize = number
  export type ObjectSizeGreaterThanBytes = number
  export type ObjectSizeLessThanBytes = number
  export type ObjectStorageClass =
    | 'STANDARD'
    | 'REDUCED_REDUNDANCY'
    | 'GLACIER'
    | 'STANDARD_IA'
    | 'ONEZONE_IA'
    | 'INTELLIGENT_TIERING'
    | 'DEEP_ARCHIVE'
    | 'OUTPOSTS'
    | 'GLACIER_IR'
    | string
  export interface ObjectVersion {
    /**
     * The entity tag is an MD5 hash of that version of the object.
     */
    ETag?: ETag
    /**
     * The algorithm that was used to create a checksum of the object.
     */
    ChecksumAlgorithm?: ChecksumAlgorithmList
    /**
     * Size in bytes of the object.
     */
    Size?: Size
    /**
     * The class of storage used to store the object.
     */
    StorageClass?: ObjectVersionStorageClass
    /**
     * The object key.
     */
    Key?: ObjectKey
    /**
     * Version ID of an object.
     */
    VersionId?: ObjectVersionId
    /**
     * Specifies whether the object is (true) or is not (false) the latest version of an object.
     */
    IsLatest?: IsLatest
    /**
     * Date and time the object was last modified.
     */
    LastModified?: LastModified
    /**
     * Specifies the owner of the object.
     */
    Owner?: Owner
  }
  export type ObjectVersionId = string
  export type ObjectVersionList = ObjectVersion[]
  export type ObjectVersionStorageClass = 'STANDARD' | string
  export interface OutputLocation {
    /**
     * Describes an S3 location that will receive the results of the restore request.
     */
    S3?: S3Location
  }
  export interface OutputSerialization {
    /**
     * Describes the serialization of CSV-encoded Select results.
     */
    CSV?: CSVOutput
    /**
     * Specifies JSON as request's output serialization format.
     */
    JSON?: JSONOutput
  }
  export interface Owner {
    /**
     * Container for the display name of the owner.
     */
    DisplayName?: DisplayName
    /**
     * Container for the ID of the owner.
     */
    ID?: ID
  }
  export type OwnerOverride = 'Destination' | string
  export interface OwnershipControls {
    /**
     * The container element for an ownership control rule.
     */
    Rules: OwnershipControlsRules
  }
  export interface OwnershipControlsRule {
    ObjectOwnership: ObjectOwnership
  }
  export type OwnershipControlsRules = OwnershipControlsRule[]
  export interface ParquetInput {}
  export interface Part {
    /**
     * Part number identifying the part. This is a positive integer between 1 and 10,000.
     */
    PartNumber?: PartNumber
    /**
     * Date and time at which the part was uploaded.
     */
    LastModified?: LastModified
    /**
     * Entity tag returned when the part was uploaded.
     */
    ETag?: ETag
    /**
     * Size in bytes of the uploaded part data.
     */
    Size?: Size
    /**
     * This header can be used as a data integrity check to verify that the data received is the same data that was originally sent. This header specifies the base64-encoded, 32-bit CRC32 checksum of the object. For more information, see Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumCRC32?: ChecksumCRC32
    /**
     * The base64-encoded, 32-bit CRC32C checksum of the object. This will only be present if it was uploaded with the object. With multipart uploads, this may not be a checksum value of the object. For more information about how checksums are calculated with multipart uploads, see  Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumCRC32C?: ChecksumCRC32C
    /**
     * The base64-encoded, 160-bit SHA-1 digest of the object. This will only be present if it was uploaded with the object. With multipart uploads, this may not be a checksum value of the object. For more information about how checksums are calculated with multipart uploads, see  Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumSHA1?: ChecksumSHA1
    /**
     * This header can be used as a data integrity check to verify that the data received is the same data that was originally sent. This header specifies the base64-encoded, 256-bit SHA-256 digest of the object. For more information, see Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumSHA256?: ChecksumSHA256
  }
  export type PartNumber = number
  export type PartNumberMarker = number
  export type Parts = Part[]
  export type PartsCount = number
  export type PartsList = ObjectPart[]
  export type Payer = 'Requester' | 'BucketOwner' | string
  export type Permission =
    | 'FULL_CONTROL'
    | 'WRITE'
    | 'WRITE_ACP'
    | 'READ'
    | 'READ_ACP'
    | string
  export type Policy = string
  export interface PolicyStatus {
    /**
     * The policy status for this bucket. TRUE indicates that this bucket is public. FALSE indicates that the bucket is not public.
     */
    IsPublic?: IsPublic
  }
  export type Prefix = string
  export type Priority = number
  export interface Progress {
    /**
     * The current number of object bytes scanned.
     */
    BytesScanned?: BytesScanned
    /**
     * The current number of uncompressed object bytes processed.
     */
    BytesProcessed?: BytesProcessed
    /**
     * The current number of bytes of records payload data returned.
     */
    BytesReturned?: BytesReturned
  }
  export interface ProgressEvent {
    /**
     * The Progress event details.
     */
    Details?: Progress
  }
  export type Protocol = 'http' | 'https' | string
  export interface PublicAccessBlockConfiguration {
    /**
     * Specifies whether Amazon S3 should block public access control lists (ACLs) for this bucket and objects in this bucket. Setting this element to TRUE causes the following behavior:   PUT Bucket ACL and PUT Object ACL calls fail if the specified ACL is public.   PUT Object calls fail if the request includes a public ACL.   PUT Bucket calls fail if the request includes a public ACL.   Enabling this setting doesn't affect existing policies or ACLs.
     */
    BlockPublicAcls?: Setting
    /**
     * Specifies whether Amazon S3 should ignore public ACLs for this bucket and objects in this bucket. Setting this element to TRUE causes Amazon S3 to ignore all public ACLs on this bucket and objects in this bucket. Enabling this setting doesn't affect the persistence of any existing ACLs and doesn't prevent new public ACLs from being set.
     */
    IgnorePublicAcls?: Setting
    /**
     * Specifies whether Amazon S3 should block public bucket policies for this bucket. Setting this element to TRUE causes Amazon S3 to reject calls to PUT Bucket policy if the specified bucket policy allows public access.  Enabling this setting doesn't affect existing bucket policies.
     */
    BlockPublicPolicy?: Setting
    /**
     * Specifies whether Amazon S3 should restrict public bucket policies for this bucket. Setting this element to TRUE restricts access to this bucket to only Amazon Web Service principals and authorized users within this account if the bucket has a public policy. Enabling this setting doesn't affect previously stored bucket policies, except that public and cross-account access within any public bucket policy, including non-public delegation to specific accounts, is blocked.
     */
    RestrictPublicBuckets?: Setting
  }
  export interface PutBucketAccelerateConfigurationRequest {
    /**
     * The name of the bucket for which the accelerate configuration is set.
     */
    Bucket: BucketName
    /**
     * Container for setting the transfer acceleration state.
     */
    AccelerateConfiguration: AccelerateConfiguration
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
    /**
     * Indicates the algorithm used to create the checksum for the object when using the SDK. This header will not provide any additional functionality if not using the SDK. When sending this header, there must be a corresponding x-amz-checksum or x-amz-trailer header sent. Otherwise, Amazon S3 fails the request with the HTTP status code 400 Bad Request. For more information, see Checking object integrity in the Amazon S3 User Guide. If you provide an individual checksum, Amazon S3 ignores any provided ChecksumAlgorithm parameter.
     */
    ChecksumAlgorithm?: ChecksumAlgorithm
  }
  export interface PutBucketAclRequest {
    /**
     * The canned ACL to apply to the bucket.
     */
    ACL?: BucketCannedACL
    /**
     * Contains the elements that set the ACL permissions for an object per grantee.
     */
    AccessControlPolicy?: AccessControlPolicy
    /**
     * The bucket to which to apply the ACL.
     */
    Bucket: BucketName
    /**
     * The base64-encoded 128-bit MD5 digest of the data. This header must be used as a message integrity check to verify that the request body was not corrupted in transit. For more information, go to RFC 1864.  For requests made using the Amazon Web Services Command Line Interface (CLI) or Amazon Web Services SDKs, this field is calculated automatically.
     */
    ContentMD5?: ContentMD5
    /**
     * Indicates the algorithm used to create the checksum for the object when using the SDK. This header will not provide any additional functionality if not using the SDK. When sending this header, there must be a corresponding x-amz-checksum or x-amz-trailer header sent. Otherwise, Amazon S3 fails the request with the HTTP status code 400 Bad Request. For more information, see Checking object integrity in the Amazon S3 User Guide. If you provide an individual checksum, Amazon S3 ignores any provided ChecksumAlgorithm parameter.
     */
    ChecksumAlgorithm?: ChecksumAlgorithm
    /**
     * Allows grantee the read, write, read ACP, and write ACP permissions on the bucket.
     */
    GrantFullControl?: GrantFullControl
    /**
     * Allows grantee to list the objects in the bucket.
     */
    GrantRead?: GrantRead
    /**
     * Allows grantee to read the bucket ACL.
     */
    GrantReadACP?: GrantReadACP
    /**
     * Allows grantee to create new objects in the bucket. For the bucket and object owners of existing objects, also allows deletions and overwrites of those objects.
     */
    GrantWrite?: GrantWrite
    /**
     * Allows grantee to write the ACL for the applicable bucket.
     */
    GrantWriteACP?: GrantWriteACP
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface PutBucketAnalyticsConfigurationRequest {
    /**
     * The name of the bucket to which an analytics configuration is stored.
     */
    Bucket: BucketName
    /**
     * The ID that identifies the analytics configuration.
     */
    Id: AnalyticsId
    /**
     * The configuration and any analyses for the analytics filter.
     */
    AnalyticsConfiguration: AnalyticsConfiguration
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface PutBucketCorsRequest {
    /**
     * Specifies the bucket impacted by the corsconfiguration.
     */
    Bucket: BucketName
    /**
     * Describes the cross-origin access configuration for objects in an Amazon S3 bucket. For more information, see Enabling Cross-Origin Resource Sharing in the Amazon S3 User Guide.
     */
    CORSConfiguration: CORSConfiguration
    /**
     * The base64-encoded 128-bit MD5 digest of the data. This header must be used as a message integrity check to verify that the request body was not corrupted in transit. For more information, go to RFC 1864.  For requests made using the Amazon Web Services Command Line Interface (CLI) or Amazon Web Services SDKs, this field is calculated automatically.
     */
    ContentMD5?: ContentMD5
    /**
     * Indicates the algorithm used to create the checksum for the object when using the SDK. This header will not provide any additional functionality if not using the SDK. When sending this header, there must be a corresponding x-amz-checksum or x-amz-trailer header sent. Otherwise, Amazon S3 fails the request with the HTTP status code 400 Bad Request. For more information, see Checking object integrity in the Amazon S3 User Guide. If you provide an individual checksum, Amazon S3 ignores any provided ChecksumAlgorithm parameter.
     */
    ChecksumAlgorithm?: ChecksumAlgorithm
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface PutBucketEncryptionRequest {
    /**
     * Specifies default encryption for a bucket using server-side encryption with Amazon S3-managed keys (SSE-S3) or customer managed keys (SSE-KMS). For information about the Amazon S3 default encryption feature, see Amazon S3 Default Bucket Encryption in the Amazon S3 User Guide.
     */
    Bucket: BucketName
    /**
     * The base64-encoded 128-bit MD5 digest of the server-side encryption configuration. For requests made using the Amazon Web Services Command Line Interface (CLI) or Amazon Web Services SDKs, this field is calculated automatically.
     */
    ContentMD5?: ContentMD5
    /**
     * Indicates the algorithm used to create the checksum for the object when using the SDK. This header will not provide any additional functionality if not using the SDK. When sending this header, there must be a corresponding x-amz-checksum or x-amz-trailer header sent. Otherwise, Amazon S3 fails the request with the HTTP status code 400 Bad Request. For more information, see Checking object integrity in the Amazon S3 User Guide. If you provide an individual checksum, Amazon S3 ignores any provided ChecksumAlgorithm parameter.
     */
    ChecksumAlgorithm?: ChecksumAlgorithm
    ServerSideEncryptionConfiguration: ServerSideEncryptionConfiguration
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface PutBucketIntelligentTieringConfigurationRequest {
    /**
     * The name of the Amazon S3 bucket whose configuration you want to modify or retrieve.
     */
    Bucket: BucketName
    /**
     * The ID used to identify the S3 Intelligent-Tiering configuration.
     */
    Id: IntelligentTieringId
    /**
     * Container for S3 Intelligent-Tiering configuration.
     */
    IntelligentTieringConfiguration: IntelligentTieringConfiguration
  }
  export interface PutBucketInventoryConfigurationRequest {
    /**
     * The name of the bucket where the inventory configuration will be stored.
     */
    Bucket: BucketName
    /**
     * The ID used to identify the inventory configuration.
     */
    Id: InventoryId
    /**
     * Specifies the inventory configuration.
     */
    InventoryConfiguration: InventoryConfiguration
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface PutBucketLifecycleConfigurationRequest {
    /**
     * The name of the bucket for which to set the configuration.
     */
    Bucket: BucketName
    /**
     * Indicates the algorithm used to create the checksum for the object when using the SDK. This header will not provide any additional functionality if not using the SDK. When sending this header, there must be a corresponding x-amz-checksum or x-amz-trailer header sent. Otherwise, Amazon S3 fails the request with the HTTP status code 400 Bad Request. For more information, see Checking object integrity in the Amazon S3 User Guide. If you provide an individual checksum, Amazon S3 ignores any provided ChecksumAlgorithm parameter.
     */
    ChecksumAlgorithm?: ChecksumAlgorithm
    /**
     * Container for lifecycle rules. You can add as many as 1,000 rules.
     */
    LifecycleConfiguration?: BucketLifecycleConfiguration
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface PutBucketLifecycleRequest {
    /**
     *
     */
    Bucket: BucketName
    /**
     *  For requests made using the Amazon Web Services Command Line Interface (CLI) or Amazon Web Services SDKs, this field is calculated automatically.
     */
    ContentMD5?: ContentMD5
    /**
     * Indicates the algorithm used to create the checksum for the object when using the SDK. This header will not provide any additional functionality if not using the SDK. When sending this header, there must be a corresponding x-amz-checksum or x-amz-trailer header sent. Otherwise, Amazon S3 fails the request with the HTTP status code 400 Bad Request. For more information, see Checking object integrity in the Amazon S3 User Guide. If you provide an individual checksum, Amazon S3 ignores any provided ChecksumAlgorithm parameter.
     */
    ChecksumAlgorithm?: ChecksumAlgorithm
    /**
     *
     */
    LifecycleConfiguration?: LifecycleConfiguration
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface PutBucketLoggingRequest {
    /**
     * The name of the bucket for which to set the logging parameters.
     */
    Bucket: BucketName
    /**
     * Container for logging status information.
     */
    BucketLoggingStatus: BucketLoggingStatus
    /**
     * The MD5 hash of the PutBucketLogging request body. For requests made using the Amazon Web Services Command Line Interface (CLI) or Amazon Web Services SDKs, this field is calculated automatically.
     */
    ContentMD5?: ContentMD5
    /**
     * Indicates the algorithm used to create the checksum for the object when using the SDK. This header will not provide any additional functionality if not using the SDK. When sending this header, there must be a corresponding x-amz-checksum or x-amz-trailer header sent. Otherwise, Amazon S3 fails the request with the HTTP status code 400 Bad Request. For more information, see Checking object integrity in the Amazon S3 User Guide. If you provide an individual checksum, Amazon S3 ignores any provided ChecksumAlgorithm parameter.
     */
    ChecksumAlgorithm?: ChecksumAlgorithm
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface PutBucketMetricsConfigurationRequest {
    /**
     * The name of the bucket for which the metrics configuration is set.
     */
    Bucket: BucketName
    /**
     * The ID used to identify the metrics configuration.
     */
    Id: MetricsId
    /**
     * Specifies the metrics configuration.
     */
    MetricsConfiguration: MetricsConfiguration
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface PutBucketNotificationConfigurationRequest {
    /**
     * The name of the bucket.
     */
    Bucket: BucketName
    NotificationConfiguration: NotificationConfiguration
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
    /**
     * Skips validation of Amazon SQS, Amazon SNS, and Lambda destinations. True or false value.
     */
    SkipDestinationValidation?: SkipValidation
  }
  export interface PutBucketNotificationRequest {
    /**
     * The name of the bucket.
     */
    Bucket: BucketName
    /**
     * The MD5 hash of the PutPublicAccessBlock request body. For requests made using the Amazon Web Services Command Line Interface (CLI) or Amazon Web Services SDKs, this field is calculated automatically.
     */
    ContentMD5?: ContentMD5
    /**
     * Indicates the algorithm used to create the checksum for the object when using the SDK. This header will not provide any additional functionality if not using the SDK. When sending this header, there must be a corresponding x-amz-checksum or x-amz-trailer header sent. Otherwise, Amazon S3 fails the request with the HTTP status code 400 Bad Request. For more information, see Checking object integrity in the Amazon S3 User Guide. If you provide an individual checksum, Amazon S3 ignores any provided ChecksumAlgorithm parameter.
     */
    ChecksumAlgorithm?: ChecksumAlgorithm
    /**
     * The container for the configuration.
     */
    NotificationConfiguration: NotificationConfigurationDeprecated
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface PutBucketOwnershipControlsRequest {
    /**
     * The name of the Amazon S3 bucket whose OwnershipControls you want to set.
     */
    Bucket: BucketName
    /**
     * The MD5 hash of the OwnershipControls request body.  For requests made using the Amazon Web Services Command Line Interface (CLI) or Amazon Web Services SDKs, this field is calculated automatically.
     */
    ContentMD5?: ContentMD5
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
    /**
     * The OwnershipControls (BucketOwnerEnforced, BucketOwnerPreferred, or ObjectWriter) that you want to apply to this Amazon S3 bucket.
     */
    OwnershipControls: OwnershipControls
  }
  export interface PutBucketPolicyRequest {
    /**
     * The name of the bucket.
     */
    Bucket: BucketName
    /**
     * The MD5 hash of the request body. For requests made using the Amazon Web Services Command Line Interface (CLI) or Amazon Web Services SDKs, this field is calculated automatically.
     */
    ContentMD5?: ContentMD5
    /**
     * Indicates the algorithm used to create the checksum for the object when using the SDK. This header will not provide any additional functionality if not using the SDK. When sending this header, there must be a corresponding x-amz-checksum or x-amz-trailer header sent. Otherwise, Amazon S3 fails the request with the HTTP status code 400 Bad Request. For more information, see Checking object integrity in the Amazon S3 User Guide. If you provide an individual checksum, Amazon S3 ignores any provided ChecksumAlgorithm parameter.
     */
    ChecksumAlgorithm?: ChecksumAlgorithm
    /**
     * Set this parameter to true to confirm that you want to remove your permissions to change this bucket policy in the future.
     */
    ConfirmRemoveSelfBucketAccess?: ConfirmRemoveSelfBucketAccess
    /**
     * The bucket policy as a JSON document.
     */
    Policy: Policy
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface PutBucketReplicationRequest {
    /**
     * The name of the bucket
     */
    Bucket: BucketName
    /**
     * The base64-encoded 128-bit MD5 digest of the data. You must use this header as a message integrity check to verify that the request body was not corrupted in transit. For more information, see RFC 1864. For requests made using the Amazon Web Services Command Line Interface (CLI) or Amazon Web Services SDKs, this field is calculated automatically.
     */
    ContentMD5?: ContentMD5
    /**
     * Indicates the algorithm used to create the checksum for the object when using the SDK. This header will not provide any additional functionality if not using the SDK. When sending this header, there must be a corresponding x-amz-checksum or x-amz-trailer header sent. Otherwise, Amazon S3 fails the request with the HTTP status code 400 Bad Request. For more information, see Checking object integrity in the Amazon S3 User Guide. If you provide an individual checksum, Amazon S3 ignores any provided ChecksumAlgorithm parameter.
     */
    ChecksumAlgorithm?: ChecksumAlgorithm
    ReplicationConfiguration: ReplicationConfiguration
    /**
     * A token to allow Object Lock to be enabled for an existing bucket.
     */
    Token?: ObjectLockToken
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface PutBucketRequestPaymentRequest {
    /**
     * The bucket name.
     */
    Bucket: BucketName
    /**
     * The base64-encoded 128-bit MD5 digest of the data. You must use this header as a message integrity check to verify that the request body was not corrupted in transit. For more information, see RFC 1864. For requests made using the Amazon Web Services Command Line Interface (CLI) or Amazon Web Services SDKs, this field is calculated automatically.
     */
    ContentMD5?: ContentMD5
    /**
     * Indicates the algorithm used to create the checksum for the object when using the SDK. This header will not provide any additional functionality if not using the SDK. When sending this header, there must be a corresponding x-amz-checksum or x-amz-trailer header sent. Otherwise, Amazon S3 fails the request with the HTTP status code 400 Bad Request. For more information, see Checking object integrity in the Amazon S3 User Guide. If you provide an individual checksum, Amazon S3 ignores any provided ChecksumAlgorithm parameter.
     */
    ChecksumAlgorithm?: ChecksumAlgorithm
    /**
     * Container for Payer.
     */
    RequestPaymentConfiguration: RequestPaymentConfiguration
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface PutBucketTaggingRequest {
    /**
     * The bucket name.
     */
    Bucket: BucketName
    /**
     * The base64-encoded 128-bit MD5 digest of the data. You must use this header as a message integrity check to verify that the request body was not corrupted in transit. For more information, see RFC 1864. For requests made using the Amazon Web Services Command Line Interface (CLI) or Amazon Web Services SDKs, this field is calculated automatically.
     */
    ContentMD5?: ContentMD5
    /**
     * Indicates the algorithm used to create the checksum for the object when using the SDK. This header will not provide any additional functionality if not using the SDK. When sending this header, there must be a corresponding x-amz-checksum or x-amz-trailer header sent. Otherwise, Amazon S3 fails the request with the HTTP status code 400 Bad Request. For more information, see Checking object integrity in the Amazon S3 User Guide. If you provide an individual checksum, Amazon S3 ignores any provided ChecksumAlgorithm parameter.
     */
    ChecksumAlgorithm?: ChecksumAlgorithm
    /**
     * Container for the TagSet and Tag elements.
     */
    Tagging: Tagging
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface PutBucketVersioningRequest {
    /**
     * The bucket name.
     */
    Bucket: BucketName
    /**
     * &gt;The base64-encoded 128-bit MD5 digest of the data. You must use this header as a message integrity check to verify that the request body was not corrupted in transit. For more information, see RFC 1864. For requests made using the Amazon Web Services Command Line Interface (CLI) or Amazon Web Services SDKs, this field is calculated automatically.
     */
    ContentMD5?: ContentMD5
    /**
     * Indicates the algorithm used to create the checksum for the object when using the SDK. This header will not provide any additional functionality if not using the SDK. When sending this header, there must be a corresponding x-amz-checksum or x-amz-trailer header sent. Otherwise, Amazon S3 fails the request with the HTTP status code 400 Bad Request. For more information, see Checking object integrity in the Amazon S3 User Guide. If you provide an individual checksum, Amazon S3 ignores any provided ChecksumAlgorithm parameter.
     */
    ChecksumAlgorithm?: ChecksumAlgorithm
    /**
     * The concatenation of the authentication device's serial number, a space, and the value that is displayed on your authentication device.
     */
    MFA?: MFA
    /**
     * Container for setting the versioning state.
     */
    VersioningConfiguration: VersioningConfiguration
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface PutBucketWebsiteRequest {
    /**
     * The bucket name.
     */
    Bucket: BucketName
    /**
     * The base64-encoded 128-bit MD5 digest of the data. You must use this header as a message integrity check to verify that the request body was not corrupted in transit. For more information, see RFC 1864. For requests made using the Amazon Web Services Command Line Interface (CLI) or Amazon Web Services SDKs, this field is calculated automatically.
     */
    ContentMD5?: ContentMD5
    /**
     * Indicates the algorithm used to create the checksum for the object when using the SDK. This header will not provide any additional functionality if not using the SDK. When sending this header, there must be a corresponding x-amz-checksum or x-amz-trailer header sent. Otherwise, Amazon S3 fails the request with the HTTP status code 400 Bad Request. For more information, see Checking object integrity in the Amazon S3 User Guide. If you provide an individual checksum, Amazon S3 ignores any provided ChecksumAlgorithm parameter.
     */
    ChecksumAlgorithm?: ChecksumAlgorithm
    /**
     * Container for the request.
     */
    WebsiteConfiguration: WebsiteConfiguration
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface PutObjectAclOutput {
    RequestCharged?: RequestCharged
  }
  export interface PutObjectAclRequest {
    /**
     * The canned ACL to apply to the object. For more information, see Canned ACL.
     */
    ACL?: ObjectCannedACL
    /**
     * Contains the elements that set the ACL permissions for an object per grantee.
     */
    AccessControlPolicy?: AccessControlPolicy
    /**
     * The bucket name that contains the object to which you want to attach the ACL.  When using this action with an access point, you must direct requests to the access point hostname. The access point hostname takes the form AccessPointName-AccountId.s3-accesspoint.Region.amazonaws.com. When using this action with an access point through the Amazon Web Services SDKs, you provide the access point ARN in place of the bucket name. For more information about access point ARNs, see Using access points in the Amazon S3 User Guide.
     */
    Bucket: BucketName
    /**
     * The base64-encoded 128-bit MD5 digest of the data. This header must be used as a message integrity check to verify that the request body was not corrupted in transit. For more information, go to RFC 1864.&gt;  For requests made using the Amazon Web Services Command Line Interface (CLI) or Amazon Web Services SDKs, this field is calculated automatically.
     */
    ContentMD5?: ContentMD5
    /**
     * Indicates the algorithm used to create the checksum for the object when using the SDK. This header will not provide any additional functionality if not using the SDK. When sending this header, there must be a corresponding x-amz-checksum or x-amz-trailer header sent. Otherwise, Amazon S3 fails the request with the HTTP status code 400 Bad Request. For more information, see Checking object integrity in the Amazon S3 User Guide. If you provide an individual checksum, Amazon S3 ignores any provided ChecksumAlgorithm parameter.
     */
    ChecksumAlgorithm?: ChecksumAlgorithm
    /**
     * Allows grantee the read, write, read ACP, and write ACP permissions on the bucket. This action is not supported by Amazon S3 on Outposts.
     */
    GrantFullControl?: GrantFullControl
    /**
     * Allows grantee to list the objects in the bucket. This action is not supported by Amazon S3 on Outposts.
     */
    GrantRead?: GrantRead
    /**
     * Allows grantee to read the bucket ACL. This action is not supported by Amazon S3 on Outposts.
     */
    GrantReadACP?: GrantReadACP
    /**
     * Allows grantee to create new objects in the bucket. For the bucket and object owners of existing objects, also allows deletions and overwrites of those objects.
     */
    GrantWrite?: GrantWrite
    /**
     * Allows grantee to write the ACL for the applicable bucket. This action is not supported by Amazon S3 on Outposts.
     */
    GrantWriteACP?: GrantWriteACP
    /**
     * Key for which the PUT action was initiated. When using this action with an access point, you must direct requests to the access point hostname. The access point hostname takes the form AccessPointName-AccountId.s3-accesspoint.Region.amazonaws.com. When using this action with an access point through the Amazon Web Services SDKs, you provide the access point ARN in place of the bucket name. For more information about access point ARNs, see Using access points in the Amazon S3 User Guide. When using this action with Amazon S3 on Outposts, you must direct requests to the S3 on Outposts hostname. The S3 on Outposts hostname takes the form  AccessPointName-AccountId.outpostID.s3-outposts.Region.amazonaws.com. When using this action with S3 on Outposts through the Amazon Web Services SDKs, you provide the Outposts bucket ARN in place of the bucket name. For more information about S3 on Outposts ARNs, see Using Amazon S3 on Outposts in the Amazon S3 User Guide.
     */
    Key: ObjectKey
    RequestPayer?: RequestPayer
    /**
     * VersionId used to reference a specific version of the object.
     */
    VersionId?: ObjectVersionId
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface PutObjectLegalHoldOutput {
    RequestCharged?: RequestCharged
  }
  export interface PutObjectLegalHoldRequest {
    /**
     * The bucket name containing the object that you want to place a legal hold on.  When using this action with an access point, you must direct requests to the access point hostname. The access point hostname takes the form AccessPointName-AccountId.s3-accesspoint.Region.amazonaws.com. When using this action with an access point through the Amazon Web Services SDKs, you provide the access point ARN in place of the bucket name. For more information about access point ARNs, see Using access points in the Amazon S3 User Guide.
     */
    Bucket: BucketName
    /**
     * The key name for the object that you want to place a legal hold on.
     */
    Key: ObjectKey
    /**
     * Container element for the legal hold configuration you want to apply to the specified object.
     */
    LegalHold?: ObjectLockLegalHold
    RequestPayer?: RequestPayer
    /**
     * The version ID of the object that you want to place a legal hold on.
     */
    VersionId?: ObjectVersionId
    /**
     * The MD5 hash for the request body. For requests made using the Amazon Web Services Command Line Interface (CLI) or Amazon Web Services SDKs, this field is calculated automatically.
     */
    ContentMD5?: ContentMD5
    /**
     * Indicates the algorithm used to create the checksum for the object when using the SDK. This header will not provide any additional functionality if not using the SDK. When sending this header, there must be a corresponding x-amz-checksum or x-amz-trailer header sent. Otherwise, Amazon S3 fails the request with the HTTP status code 400 Bad Request. For more information, see Checking object integrity in the Amazon S3 User Guide. If you provide an individual checksum, Amazon S3 ignores any provided ChecksumAlgorithm parameter.
     */
    ChecksumAlgorithm?: ChecksumAlgorithm
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface PutObjectLockConfigurationOutput {
    RequestCharged?: RequestCharged
  }
  export interface PutObjectLockConfigurationRequest {
    /**
     * The bucket whose Object Lock configuration you want to create or replace.
     */
    Bucket: BucketName
    /**
     * The Object Lock configuration that you want to apply to the specified bucket.
     */
    ObjectLockConfiguration?: ObjectLockConfiguration
    RequestPayer?: RequestPayer
    /**
     * A token to allow Object Lock to be enabled for an existing bucket.
     */
    Token?: ObjectLockToken
    /**
     * The MD5 hash for the request body. For requests made using the Amazon Web Services Command Line Interface (CLI) or Amazon Web Services SDKs, this field is calculated automatically.
     */
    ContentMD5?: ContentMD5
    /**
     * Indicates the algorithm used to create the checksum for the object when using the SDK. This header will not provide any additional functionality if not using the SDK. When sending this header, there must be a corresponding x-amz-checksum or x-amz-trailer header sent. Otherwise, Amazon S3 fails the request with the HTTP status code 400 Bad Request. For more information, see Checking object integrity in the Amazon S3 User Guide. If you provide an individual checksum, Amazon S3 ignores any provided ChecksumAlgorithm parameter.
     */
    ChecksumAlgorithm?: ChecksumAlgorithm
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface PutObjectOutput {
    /**
     * If the expiration is configured for the object (see PutBucketLifecycleConfiguration), the response includes this header. It includes the expiry-date and rule-id key-value pairs that provide information about object expiration. The value of the rule-id is URL-encoded.
     */
    Expiration?: Expiration
    /**
     * Entity tag for the uploaded object.
     */
    ETag?: ETag
    /**
     * The base64-encoded, 32-bit CRC32 checksum of the object. This will only be present if it was uploaded with the object. With multipart uploads, this may not be a checksum value of the object. For more information about how checksums are calculated with multipart uploads, see  Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumCRC32?: ChecksumCRC32
    /**
     * The base64-encoded, 32-bit CRC32C checksum of the object. This will only be present if it was uploaded with the object. With multipart uploads, this may not be a checksum value of the object. For more information about how checksums are calculated with multipart uploads, see  Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumCRC32C?: ChecksumCRC32C
    /**
     * The base64-encoded, 160-bit SHA-1 digest of the object. This will only be present if it was uploaded with the object. With multipart uploads, this may not be a checksum value of the object. For more information about how checksums are calculated with multipart uploads, see  Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumSHA1?: ChecksumSHA1
    /**
     * The base64-encoded, 256-bit SHA-256 digest of the object. This will only be present if it was uploaded with the object. With multipart uploads, this may not be a checksum value of the object. For more information about how checksums are calculated with multipart uploads, see  Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumSHA256?: ChecksumSHA256
    /**
     * If you specified server-side encryption either with an Amazon Web Services KMS key or Amazon S3-managed encryption key in your PUT request, the response includes this header. It confirms the encryption algorithm that Amazon S3 used to encrypt the object.
     */
    ServerSideEncryption?: ServerSideEncryption
    /**
     * Version of the object.
     */
    VersionId?: ObjectVersionId
    /**
     * If server-side encryption with a customer-provided encryption key was requested, the response will include this header confirming the encryption algorithm used.
     */
    SSECustomerAlgorithm?: SSECustomerAlgorithm
    /**
     * If server-side encryption with a customer-provided encryption key was requested, the response will include this header to provide round-trip message integrity verification of the customer-provided encryption key.
     */
    SSECustomerKeyMD5?: SSECustomerKeyMD5
    /**
     * If x-amz-server-side-encryption is present and has the value of aws:kms, this header specifies the ID of the Amazon Web Services Key Management Service (Amazon Web Services KMS) symmetric customer managed key that was used for the object.
     */
    SSEKMSKeyId?: SSEKMSKeyId
    /**
     * If present, specifies the Amazon Web Services KMS Encryption Context to use for object encryption. The value of this header is a base64-encoded UTF-8 string holding JSON with the encryption context key-value pairs.
     */
    SSEKMSEncryptionContext?: SSEKMSEncryptionContext
    /**
     * Indicates whether the uploaded object uses an S3 Bucket Key for server-side encryption with Amazon Web Services KMS (SSE-KMS).
     */
    BucketKeyEnabled?: BucketKeyEnabled
    RequestCharged?: RequestCharged
  }
  export interface PutObjectRequest {
    /**
     * The canned ACL to apply to the object. For more information, see Canned ACL. This action is not supported by Amazon S3 on Outposts.
     */
    ACL?: ObjectCannedACL
    /**
     * The bucket name to which the PUT action was initiated.  When using this action with an access point, you must direct requests to the access point hostname. The access point hostname takes the form AccessPointName-AccountId.s3-accesspoint.Region.amazonaws.com. When using this action with an access point through the Amazon Web Services SDKs, you provide the access point ARN in place of the bucket name. For more information about access point ARNs, see Using access points in the Amazon S3 User Guide. When using this action with Amazon S3 on Outposts, you must direct requests to the S3 on Outposts hostname. The S3 on Outposts hostname takes the form  AccessPointName-AccountId.outpostID.s3-outposts.Region.amazonaws.com. When using this action with S3 on Outposts through the Amazon Web Services SDKs, you provide the Outposts bucket ARN in place of the bucket name. For more information about S3 on Outposts ARNs, see Using Amazon S3 on Outposts in the Amazon S3 User Guide.
     */
    Bucket: BucketName
    /**
     *  Can be used to specify caching behavior along the request/reply chain. For more information, see http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.9.
     */
    CacheControl?: CacheControl
    /**
     * Specifies presentational information for the object. For more information, see http://www.w3.org/Protocols/rfc2616/rfc2616-sec19.html#sec19.5.1.
     */
    ContentDisposition?: ContentDisposition
    /**
     * Specifies what content encodings have been applied to the object and thus what decoding mechanisms must be applied to obtain the media-type referenced by the Content-Type header field. For more information, see http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.11.
     */
    ContentEncoding?: ContentEncoding
    /**
     * The language the content is in.
     */
    ContentLanguage?: ContentLanguage
    /**
     * Size of the body in bytes. This parameter is useful when the size of the body cannot be determined automatically. For more information, see http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.13.
     */
    ContentLength?: ContentLength
    /**
     * The base64-encoded 128-bit MD5 digest of the message (without the headers) according to RFC 1864. This header can be used as a message integrity check to verify that the data is the same data that was originally sent. Although it is optional, we recommend using the Content-MD5 mechanism as an end-to-end integrity check. For more information about REST request authentication, see REST Authentication.
     */
    ContentMD5?: ContentMD5
    /**
     * A standard MIME type describing the format of the contents. For more information, see http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.17.
     */
    ContentType?: ContentType
    /**
     * Indicates the algorithm used to create the checksum for the object when using the SDK. This header will not provide any additional functionality if not using the SDK. When sending this header, there must be a corresponding x-amz-checksum or x-amz-trailer header sent. Otherwise, Amazon S3 fails the request with the HTTP status code 400 Bad Request. For more information, see Checking object integrity in the Amazon S3 User Guide. If you provide an individual checksum, Amazon S3 ignores any provided ChecksumAlgorithm parameter.
     */
    ChecksumAlgorithm?: ChecksumAlgorithm
    /**
     * This header can be used as a data integrity check to verify that the data received is the same data that was originally sent. This header specifies the base64-encoded, 32-bit CRC32 checksum of the object. For more information, see Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumCRC32?: ChecksumCRC32
    /**
     * This header can be used as a data integrity check to verify that the data received is the same data that was originally sent. This header specifies the base64-encoded, 32-bit CRC32C checksum of the object. For more information, see Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumCRC32C?: ChecksumCRC32C
    /**
     * This header can be used as a data integrity check to verify that the data received is the same data that was originally sent. This header specifies the base64-encoded, 160-bit SHA-1 digest of the object. For more information, see Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumSHA1?: ChecksumSHA1
    /**
     * This header can be used as a data integrity check to verify that the data received is the same data that was originally sent. This header specifies the base64-encoded, 256-bit SHA-256 digest of the object. For more information, see Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumSHA256?: ChecksumSHA256
    /**
     * The date and time at which the object is no longer cacheable. For more information, see http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.21.
     */
    Expires?: Expires
    /**
     * Gives the grantee READ, READ_ACP, and WRITE_ACP permissions on the object. This action is not supported by Amazon S3 on Outposts.
     */
    GrantFullControl?: GrantFullControl
    /**
     * Allows grantee to read the object data and its metadata. This action is not supported by Amazon S3 on Outposts.
     */
    GrantRead?: GrantRead
    /**
     * Allows grantee to read the object ACL. This action is not supported by Amazon S3 on Outposts.
     */
    GrantReadACP?: GrantReadACP
    /**
     * Allows grantee to write the ACL for the applicable object. This action is not supported by Amazon S3 on Outposts.
     */
    GrantWriteACP?: GrantWriteACP
    /**
     * Object key for which the PUT action was initiated.
     */
    Key: ObjectKey
    /**
     * A map of metadata to store with the object in S3.
     */
    Metadata?: Metadata
    /**
     * The server-side encryption algorithm used when storing this object in Amazon S3 (for example, AES256, aws:kms).
     */
    ServerSideEncryption?: ServerSideEncryption
    /**
     * By default, Amazon S3 uses the STANDARD Storage Class to store newly created objects. The STANDARD storage class provides high durability and high availability. Depending on performance needs, you can specify a different Storage Class. Amazon S3 on Outposts only uses the OUTPOSTS Storage Class. For more information, see Storage Classes in the Amazon S3 User Guide.
     */
    StorageClass?: StorageClass
    /**
     * If the bucket is configured as a website, redirects requests for this object to another object in the same bucket or to an external URL. Amazon S3 stores the value of this header in the object metadata. For information about object metadata, see Object Key and Metadata. In the following example, the request header sets the redirect to an object (anotherPage.html) in the same bucket:  x-amz-website-redirect-location: /anotherPage.html  In the following example, the request header sets the object redirect to another website:  x-amz-website-redirect-location: http://www.example.com/  For more information about website hosting in Amazon S3, see Hosting Websites on Amazon S3 and How to Configure Website Page Redirects.
     */
    WebsiteRedirectLocation?: WebsiteRedirectLocation
    /**
     * Specifies the algorithm to use to when encrypting the object (for example, AES256).
     */
    SSECustomerAlgorithm?: SSECustomerAlgorithm
    /**
     * Specifies the customer-provided encryption key for Amazon S3 to use in encrypting data. This value is used to store the object and then it is discarded; Amazon S3 does not store the encryption key. The key must be appropriate for use with the algorithm specified in the x-amz-server-side-encryption-customer-algorithm header.
     */
    SSECustomerKey?: SSECustomerKey
    /**
     * Specifies the 128-bit MD5 digest of the encryption key according to RFC 1321. Amazon S3 uses this header for a message integrity check to ensure that the encryption key was transmitted without error.
     */
    SSECustomerKeyMD5?: SSECustomerKeyMD5
    /**
     * If x-amz-server-side-encryption is present and has the value of aws:kms, this header specifies the ID of the Amazon Web Services Key Management Service (Amazon Web Services KMS) symmetrical customer managed key that was used for the object. If you specify x-amz-server-side-encryption:aws:kms, but do not provide x-amz-server-side-encryption-aws-kms-key-id, Amazon S3 uses the Amazon Web Services managed key to protect the data. If the KMS key does not exist in the same account issuing the command, you must use the full ARN and not just the ID.
     */
    SSEKMSKeyId?: SSEKMSKeyId
    /**
     * Specifies the Amazon Web Services KMS Encryption Context to use for object encryption. The value of this header is a base64-encoded UTF-8 string holding JSON with the encryption context key-value pairs.
     */
    SSEKMSEncryptionContext?: SSEKMSEncryptionContext
    /**
     * Specifies whether Amazon S3 should use an S3 Bucket Key for object encryption with server-side encryption using AWS KMS (SSE-KMS). Setting this header to true causes Amazon S3 to use an S3 Bucket Key for object encryption with SSE-KMS. Specifying this header with a PUT action doesn’t affect bucket-level settings for S3 Bucket Key.
     */
    BucketKeyEnabled?: BucketKeyEnabled
    RequestPayer?: RequestPayer
    /**
     * The tag-set for the object. The tag-set must be encoded as URL Query parameters. (For example, "Key1=Value1")
     */
    Tagging?: TaggingHeader
    /**
     * The Object Lock mode that you want to apply to this object.
     */
    ObjectLockMode?: ObjectLockMode
    /**
     * The date and time when you want this object's Object Lock to expire. Must be formatted as a timestamp parameter.
     */
    ObjectLockRetainUntilDate?: ObjectLockRetainUntilDate
    /**
     * Specifies whether a legal hold will be applied to this object. For more information about S3 Object Lock, see Object Lock.
     */
    ObjectLockLegalHoldStatus?: ObjectLockLegalHoldStatus
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface PutObjectRetentionOutput {
    RequestCharged?: RequestCharged
  }
  export interface PutObjectRetentionRequest {
    /**
     * The bucket name that contains the object you want to apply this Object Retention configuration to.  When using this action with an access point, you must direct requests to the access point hostname. The access point hostname takes the form AccessPointName-AccountId.s3-accesspoint.Region.amazonaws.com. When using this action with an access point through the Amazon Web Services SDKs, you provide the access point ARN in place of the bucket name. For more information about access point ARNs, see Using access points in the Amazon S3 User Guide.
     */
    Bucket: BucketName
    /**
     * The key name for the object that you want to apply this Object Retention configuration to.
     */
    Key: ObjectKey
    /**
     * The container element for the Object Retention configuration.
     */
    Retention?: ObjectLockRetention
    RequestPayer?: RequestPayer
    /**
     * The version ID for the object that you want to apply this Object Retention configuration to.
     */
    VersionId?: ObjectVersionId
    /**
     * Indicates whether this action should bypass Governance-mode restrictions.
     */
    BypassGovernanceRetention?: BypassGovernanceRetention
    /**
     * The MD5 hash for the request body. For requests made using the Amazon Web Services Command Line Interface (CLI) or Amazon Web Services SDKs, this field is calculated automatically.
     */
    ContentMD5?: ContentMD5
    /**
     * Indicates the algorithm used to create the checksum for the object when using the SDK. This header will not provide any additional functionality if not using the SDK. When sending this header, there must be a corresponding x-amz-checksum or x-amz-trailer header sent. Otherwise, Amazon S3 fails the request with the HTTP status code 400 Bad Request. For more information, see Checking object integrity in the Amazon S3 User Guide. If you provide an individual checksum, Amazon S3 ignores any provided ChecksumAlgorithm parameter.
     */
    ChecksumAlgorithm?: ChecksumAlgorithm
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface PutObjectTaggingOutput {
    /**
     * The versionId of the object the tag-set was added to.
     */
    VersionId?: ObjectVersionId
  }
  export interface PutObjectTaggingRequest {
    /**
     * The bucket name containing the object.  When using this action with an access point, you must direct requests to the access point hostname. The access point hostname takes the form AccessPointName-AccountId.s3-accesspoint.Region.amazonaws.com. When using this action with an access point through the Amazon Web Services SDKs, you provide the access point ARN in place of the bucket name. For more information about access point ARNs, see Using access points in the Amazon S3 User Guide. When using this action with Amazon S3 on Outposts, you must direct requests to the S3 on Outposts hostname. The S3 on Outposts hostname takes the form  AccessPointName-AccountId.outpostID.s3-outposts.Region.amazonaws.com. When using this action with S3 on Outposts through the Amazon Web Services SDKs, you provide the Outposts bucket ARN in place of the bucket name. For more information about S3 on Outposts ARNs, see Using Amazon S3 on Outposts in the Amazon S3 User Guide.
     */
    Bucket: BucketName
    /**
     * Name of the object key.
     */
    Key: ObjectKey
    /**
     * The versionId of the object that the tag-set will be added to.
     */
    VersionId?: ObjectVersionId
    /**
     * The MD5 hash for the request body. For requests made using the Amazon Web Services Command Line Interface (CLI) or Amazon Web Services SDKs, this field is calculated automatically.
     */
    ContentMD5?: ContentMD5
    /**
     * Indicates the algorithm used to create the checksum for the object when using the SDK. This header will not provide any additional functionality if not using the SDK. When sending this header, there must be a corresponding x-amz-checksum or x-amz-trailer header sent. Otherwise, Amazon S3 fails the request with the HTTP status code 400 Bad Request. For more information, see Checking object integrity in the Amazon S3 User Guide. If you provide an individual checksum, Amazon S3 ignores any provided ChecksumAlgorithm parameter.
     */
    ChecksumAlgorithm?: ChecksumAlgorithm
    /**
     * Container for the TagSet and Tag elements
     */
    Tagging: Tagging
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
    RequestPayer?: RequestPayer
  }
  export interface PutPublicAccessBlockRequest {
    /**
     * The name of the Amazon S3 bucket whose PublicAccessBlock configuration you want to set.
     */
    Bucket: BucketName
    /**
     * The MD5 hash of the PutPublicAccessBlock request body.  For requests made using the Amazon Web Services Command Line Interface (CLI) or Amazon Web Services SDKs, this field is calculated automatically.
     */
    ContentMD5?: ContentMD5
    /**
     * Indicates the algorithm used to create the checksum for the object when using the SDK. This header will not provide any additional functionality if not using the SDK. When sending this header, there must be a corresponding x-amz-checksum or x-amz-trailer header sent. Otherwise, Amazon S3 fails the request with the HTTP status code 400 Bad Request. For more information, see Checking object integrity in the Amazon S3 User Guide. If you provide an individual checksum, Amazon S3 ignores any provided ChecksumAlgorithm parameter.
     */
    ChecksumAlgorithm?: ChecksumAlgorithm
    /**
     * The PublicAccessBlock configuration that you want to apply to this Amazon S3 bucket. You can enable the configuration options in any combination. For more information about when Amazon S3 considers a bucket or object public, see The Meaning of "Public" in the Amazon S3 User Guide.
     */
    PublicAccessBlockConfiguration: PublicAccessBlockConfiguration
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export type QueueArn = string
  export interface QueueConfiguration {
    Id?: NotificationId
    /**
     * The Amazon Resource Name (ARN) of the Amazon SQS queue to which Amazon S3 publishes a message when it detects events of the specified type.
     */
    QueueArn: QueueArn
    /**
     * A collection of bucket events for which to send notifications
     */
    Events: EventList
    Filter?: NotificationConfigurationFilter
  }
  export interface QueueConfigurationDeprecated {
    Id?: NotificationId
    Event?: Event
    /**
     * A collection of bucket events for which to send notifications.
     */
    Events?: EventList
    /**
     * The Amazon Resource Name (ARN) of the Amazon SQS queue to which Amazon S3 publishes a message when it detects events of the specified type.
     */
    Queue?: QueueArn
  }
  export type QueueConfigurationList = QueueConfiguration[]
  export type Quiet = boolean
  export type QuoteCharacter = string
  export type QuoteEscapeCharacter = string
  export type QuoteFields = 'ALWAYS' | 'ASNEEDED' | string
  export type Range = string
  export type RecordDelimiter = string
  export interface RecordsEvent {
    /**
     * The byte array of partial, one or more result records.
     */
    Payload?: Buffer
  }
  export interface Redirect {
    /**
     * The host name to use in the redirect request.
     */
    HostName?: HostName
    /**
     * The HTTP redirect code to use on the response. Not required if one of the siblings is present.
     */
    HttpRedirectCode?: HttpRedirectCode
    /**
     * Protocol to use when redirecting requests. The default is the protocol that is used in the original request.
     */
    Protocol?: Protocol
    /**
     * The object key prefix to use in the redirect request. For example, to redirect requests for all pages with prefix docs/ (objects in the docs/ folder) to documents/, you can set a condition block with KeyPrefixEquals set to docs/ and in the Redirect set ReplaceKeyPrefixWith to /documents. Not required if one of the siblings is present. Can be present only if ReplaceKeyWith is not provided.  Replacement must be made for object keys containing special characters (such as carriage returns) when using XML requests. For more information, see  XML related object key constraints.
     */
    ReplaceKeyPrefixWith?: ReplaceKeyPrefixWith
    /**
     * The specific object key to use in the redirect request. For example, redirect request to error.html. Not required if one of the siblings is present. Can be present only if ReplaceKeyPrefixWith is not provided.  Replacement must be made for object keys containing special characters (such as carriage returns) when using XML requests. For more information, see  XML related object key constraints.
     */
    ReplaceKeyWith?: ReplaceKeyWith
  }
  export interface RedirectAllRequestsTo {
    /**
     * Name of the host where requests are redirected.
     */
    HostName: HostName
    /**
     * Protocol to use when redirecting requests. The default is the protocol that is used in the original request.
     */
    Protocol?: Protocol
  }
  export type ReplaceKeyPrefixWith = string
  export type ReplaceKeyWith = string
  export type ReplicaKmsKeyID = string
  export interface ReplicaModifications {
    /**
     * Specifies whether Amazon S3 replicates modifications on replicas.
     */
    Status: ReplicaModificationsStatus
  }
  export type ReplicaModificationsStatus = 'Enabled' | 'Disabled' | string
  export interface ReplicationConfiguration {
    /**
     * The Amazon Resource Name (ARN) of the Identity and Access Management (IAM) role that Amazon S3 assumes when replicating objects. For more information, see How to Set Up Replication in the Amazon S3 User Guide.
     */
    Role: Role
    /**
     * A container for one or more replication rules. A replication configuration must have at least one rule and can contain a maximum of 1,000 rules.
     */
    Rules: ReplicationRules
  }
  export interface ReplicationRule {
    /**
     * A unique identifier for the rule. The maximum value is 255 characters.
     */
    ID?: ID
    /**
     * The priority indicates which rule has precedence whenever two or more replication rules conflict. Amazon S3 will attempt to replicate objects according to all replication rules. However, if there are two or more rules with the same destination bucket, then objects will be replicated according to the rule with the highest priority. The higher the number, the higher the priority.  For more information, see Replication in the Amazon S3 User Guide.
     */
    Priority?: Priority
    /**
     * An object key name prefix that identifies the object or objects to which the rule applies. The maximum prefix length is 1,024 characters. To include all objects in a bucket, specify an empty string.   Replacement must be made for object keys containing special characters (such as carriage returns) when using XML requests. For more information, see  XML related object key constraints.
     */
    Prefix?: Prefix
    Filter?: ReplicationRuleFilter
    /**
     * Specifies whether the rule is enabled.
     */
    Status: ReplicationRuleStatus
    /**
     * A container that describes additional filters for identifying the source objects that you want to replicate. You can choose to enable or disable the replication of these objects. Currently, Amazon S3 supports only the filter that you can specify for objects created with server-side encryption using a customer managed key stored in Amazon Web Services Key Management Service (SSE-KMS).
     */
    SourceSelectionCriteria?: SourceSelectionCriteria
    /**
     *
     */
    ExistingObjectReplication?: ExistingObjectReplication
    /**
     * A container for information about the replication destination and its configurations including enabling the S3 Replication Time Control (S3 RTC).
     */
    Destination: Destination
    DeleteMarkerReplication?: DeleteMarkerReplication
  }
  export interface ReplicationRuleAndOperator {
    /**
     * An object key name prefix that identifies the subset of objects to which the rule applies.
     */
    Prefix?: Prefix
    /**
     * An array of tags containing key and value pairs.
     */
    Tags?: TagSet
  }
  export interface ReplicationRuleFilter {
    /**
     * An object key name prefix that identifies the subset of objects to which the rule applies.  Replacement must be made for object keys containing special characters (such as carriage returns) when using XML requests. For more information, see  XML related object key constraints.
     */
    Prefix?: Prefix
    /**
     * A container for specifying a tag key and value.  The rule applies only to objects that have the tag in their tag set.
     */
    Tag?: Tag
    /**
     * A container for specifying rule filters. The filters determine the subset of objects to which the rule applies. This element is required only if you specify more than one filter. For example:    If you specify both a Prefix and a Tag filter, wrap these filters in an And tag.   If you specify a filter based on multiple tags, wrap the Tag elements in an And tag.
     */
    And?: ReplicationRuleAndOperator
  }
  export type ReplicationRuleStatus = 'Enabled' | 'Disabled' | string
  export type ReplicationRules = ReplicationRule[]
  export type ReplicationStatus =
    | 'COMPLETE'
    | 'PENDING'
    | 'FAILED'
    | 'REPLICA'
    | string
  export interface ReplicationTime {
    /**
     *  Specifies whether the replication time is enabled.
     */
    Status: ReplicationTimeStatus
    /**
     *  A container specifying the time by which replication should be complete for all objects and operations on objects.
     */
    Time: ReplicationTimeValue
  }
  export type ReplicationTimeStatus = 'Enabled' | 'Disabled' | string
  export interface ReplicationTimeValue {
    /**
     *  Contains an integer specifying time in minutes.   Valid value: 15
     */
    Minutes?: Minutes
  }
  export type RequestCharged = 'requester' | string
  export type RequestPayer = 'requester' | string
  export interface RequestPaymentConfiguration {
    /**
     * Specifies who pays for the download and request fees.
     */
    Payer: Payer
  }
  export interface RequestProgress {
    /**
     * Specifies whether periodic QueryProgress frames should be sent. Valid values: TRUE, FALSE. Default value: FALSE.
     */
    Enabled?: EnableRequestProgress
  }
  export type RequestRoute = string
  export type RequestToken = string
  export type ResponseCacheControl = string
  export type ResponseContentDisposition = string
  export type ResponseContentEncoding = string
  export type ResponseContentLanguage = string
  export type ResponseContentType = string
  export type ResponseExpires = Date
  export type Restore = string
  export interface RestoreObjectOutput {
    RequestCharged?: RequestCharged
    /**
     * Indicates the path in the provided S3 output location where Select results will be restored to.
     */
    RestoreOutputPath?: RestoreOutputPath
  }
  export interface RestoreObjectRequest {
    /**
     * The bucket name containing the object to restore.  When using this action with an access point, you must direct requests to the access point hostname. The access point hostname takes the form AccessPointName-AccountId.s3-accesspoint.Region.amazonaws.com. When using this action with an access point through the Amazon Web Services SDKs, you provide the access point ARN in place of the bucket name. For more information about access point ARNs, see Using access points in the Amazon S3 User Guide. When using this action with Amazon S3 on Outposts, you must direct requests to the S3 on Outposts hostname. The S3 on Outposts hostname takes the form  AccessPointName-AccountId.outpostID.s3-outposts.Region.amazonaws.com. When using this action with S3 on Outposts through the Amazon Web Services SDKs, you provide the Outposts bucket ARN in place of the bucket name. For more information about S3 on Outposts ARNs, see Using Amazon S3 on Outposts in the Amazon S3 User Guide.
     */
    Bucket: BucketName
    /**
     * Object key for which the action was initiated.
     */
    Key: ObjectKey
    /**
     * VersionId used to reference a specific version of the object.
     */
    VersionId?: ObjectVersionId
    RestoreRequest?: RestoreRequest
    RequestPayer?: RequestPayer
    /**
     * Indicates the algorithm used to create the checksum for the object when using the SDK. This header will not provide any additional functionality if not using the SDK. When sending this header, there must be a corresponding x-amz-checksum or x-amz-trailer header sent. Otherwise, Amazon S3 fails the request with the HTTP status code 400 Bad Request. For more information, see Checking object integrity in the Amazon S3 User Guide. If you provide an individual checksum, Amazon S3 ignores any provided ChecksumAlgorithm parameter.
     */
    ChecksumAlgorithm?: ChecksumAlgorithm
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export type RestoreOutputPath = string
  export interface RestoreRequest {
    /**
     * Lifetime of the active copy in days. Do not use with restores that specify OutputLocation. The Days element is required for regular restores, and must not be provided for select requests.
     */
    Days?: Days
    /**
     * S3 Glacier related parameters pertaining to this job. Do not use with restores that specify OutputLocation.
     */
    GlacierJobParameters?: GlacierJobParameters
    /**
     * Type of restore request.
     */
    Type?: RestoreRequestType
    /**
     * Retrieval tier at which the restore will be processed.
     */
    Tier?: Tier
    /**
     * The optional description for the job.
     */
    Description?: Description
    /**
     * Describes the parameters for Select job types.
     */
    SelectParameters?: SelectParameters
    /**
     * Describes the location where the restore job's output is stored.
     */
    OutputLocation?: OutputLocation
  }
  export type RestoreRequestType = 'SELECT' | string
  export type Role = string
  export interface RoutingRule {
    /**
     * A container for describing a condition that must be met for the specified redirect to apply. For example, 1. If request is for pages in the /docs folder, redirect to the /documents folder. 2. If request results in HTTP error 4xx, redirect request to another host where you might process the error.
     */
    Condition?: Condition
    /**
     * Container for redirect information. You can redirect requests to another host, to another page, or with another protocol. In the event of an error, you can specify a different error code to return.
     */
    Redirect: Redirect
  }
  export type RoutingRules = RoutingRule[]
  export interface Rule {
    /**
     * Specifies the expiration for the lifecycle of the object.
     */
    Expiration?: LifecycleExpiration
    /**
     * Unique identifier for the rule. The value can't be longer than 255 characters.
     */
    ID?: ID
    /**
     * Object key prefix that identifies one or more objects to which this rule applies.  Replacement must be made for object keys containing special characters (such as carriage returns) when using XML requests. For more information, see  XML related object key constraints.
     */
    Prefix: Prefix
    /**
     * If Enabled, the rule is currently being applied. If Disabled, the rule is not currently being applied.
     */
    Status: ExpirationStatus
    /**
     * Specifies when an object transitions to a specified storage class. For more information about Amazon S3 lifecycle configuration rules, see Transitioning Objects Using Amazon S3 Lifecycle in the Amazon S3 User Guide.
     */
    Transition?: Transition
    NoncurrentVersionTransition?: NoncurrentVersionTransition
    NoncurrentVersionExpiration?: NoncurrentVersionExpiration
    AbortIncompleteMultipartUpload?: AbortIncompleteMultipartUpload
  }
  export type Rules = Rule[]
  export interface S3KeyFilter {
    FilterRules?: FilterRuleList
  }
  export interface S3Location {
    /**
     * The name of the bucket where the restore results will be placed.
     */
    BucketName: BucketName
    /**
     * The prefix that is prepended to the restore results for this request.
     */
    Prefix: LocationPrefix
    Encryption?: Encryption
    /**
     * The canned ACL to apply to the restore results.
     */
    CannedACL?: ObjectCannedACL
    /**
     * A list of grants that control access to the staged results.
     */
    AccessControlList?: Grants
    /**
     * The tag-set that is applied to the restore results.
     */
    Tagging?: Tagging
    /**
     * A list of metadata to store with the restore results in S3.
     */
    UserMetadata?: UserMetadata
    /**
     * The class of storage used to store the restore results.
     */
    StorageClass?: StorageClass
  }
  export type SSECustomerAlgorithm = string
  export type SSECustomerKey = Buffer | Uint8Array | Blob | string
  export type SSECustomerKeyMD5 = string
  export interface SSEKMS {
    /**
     * Specifies the ID of the Amazon Web Services Key Management Service (Amazon Web Services KMS) symmetric customer managed key to use for encrypting inventory reports.
     */
    KeyId: SSEKMSKeyId
  }
  export type SSEKMSEncryptionContext = string
  export type SSEKMSKeyId = string
  export interface SSES3 {}
  export interface ScanRange {
    /**
     * Specifies the start of the byte range. This parameter is optional. Valid values: non-negative integers. The default value is 0. If only start is supplied, it means scan from that point to the end of the file. For example, &lt;scanrange&gt;&lt;start&gt;50&lt;/start&gt;&lt;/scanrange&gt; means scan from byte 50 until the end of the file.
     */
    Start?: Start
    /**
     * Specifies the end of the byte range. This parameter is optional. Valid values: non-negative integers. The default value is one less than the size of the object being queried. If only the End parameter is supplied, it is interpreted to mean scan the last N bytes of the file. For example, &lt;scanrange&gt;&lt;end&gt;50&lt;/end&gt;&lt;/scanrange&gt; means scan the last 50 bytes.
     */
    End?: End
  }
  export type SelectObjectContentEventStream = EventStream<{
    Records?: RecordsEvent
    Stats?: StatsEvent
    Progress?: ProgressEvent
    Cont?: ContinuationEvent
    End?: EndEvent
  }>
  export interface SelectObjectContentOutput {
    /**
     * The array of results.
     */
    Payload?: SelectObjectContentEventStream
  }
  export interface SelectObjectContentRequest {
    /**
     * The S3 bucket.
     */
    Bucket: BucketName
    /**
     * The object key.
     */
    Key: ObjectKey
    /**
     * The server-side encryption (SSE) algorithm used to encrypt the object. This parameter is needed only when the object was created using a checksum algorithm. For more information, see Protecting data using SSE-C keys in the Amazon S3 User Guide.
     */
    SSECustomerAlgorithm?: SSECustomerAlgorithm
    /**
     * The server-side encryption (SSE) customer managed key. This parameter is needed only when the object was created using a checksum algorithm. For more information, see Protecting data using SSE-C keys in the Amazon S3 User Guide.
     */
    SSECustomerKey?: SSECustomerKey
    /**
     * The MD5 server-side encryption (SSE) customer managed key. This parameter is needed only when the object was created using a checksum algorithm. For more information, see Protecting data using SSE-C keys in the Amazon S3 User Guide.
     */
    SSECustomerKeyMD5?: SSECustomerKeyMD5
    /**
     * The expression that is used to query the object.
     */
    Expression: Expression
    /**
     * The type of the provided expression (for example, SQL).
     */
    ExpressionType: ExpressionType
    /**
     * Specifies if periodic request progress information should be enabled.
     */
    RequestProgress?: RequestProgress
    /**
     * Describes the format of the data in the object that is being queried.
     */
    InputSerialization: InputSerialization
    /**
     * Describes the format of the data that you want Amazon S3 to return in response.
     */
    OutputSerialization: OutputSerialization
    /**
     * Specifies the byte range of the object to get the records from. A record is processed when its first byte is contained by the range. This parameter is optional, but when specified, it must not be empty. See RFC 2616, Section 14.35.1 about how to specify the start and end of the range.  ScanRangemay be used in the following ways:    &lt;scanrange&gt;&lt;start&gt;50&lt;/start&gt;&lt;end&gt;100&lt;/end&gt;&lt;/scanrange&gt; - process only the records starting between the bytes 50 and 100 (inclusive, counting from zero)    &lt;scanrange&gt;&lt;start&gt;50&lt;/start&gt;&lt;/scanrange&gt; - process only the records starting after the byte 50    &lt;scanrange&gt;&lt;end&gt;50&lt;/end&gt;&lt;/scanrange&gt; - process only the records within the last 50 bytes of the file.
     */
    ScanRange?: ScanRange
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export interface SelectParameters {
    /**
     * Describes the serialization format of the object.
     */
    InputSerialization: InputSerialization
    /**
     * The type of the provided expression (for example, SQL).
     */
    ExpressionType: ExpressionType
    /**
     * The expression that is used to query the object.
     */
    Expression: Expression
    /**
     * Describes how the results of the Select job are serialized.
     */
    OutputSerialization: OutputSerialization
  }
  export type ServerSideEncryption = 'AES256' | 'aws:kms' | string
  export interface ServerSideEncryptionByDefault {
    /**
     * Server-side encryption algorithm to use for the default encryption.
     */
    SSEAlgorithm: ServerSideEncryption
    /**
     * Amazon Web Services Key Management Service (KMS) customer Amazon Web Services KMS key ID to use for the default encryption. This parameter is allowed if and only if SSEAlgorithm is set to aws:kms. You can specify the key ID or the Amazon Resource Name (ARN) of the KMS key. However, if you are using encryption with cross-account or Amazon Web Services service operations you must use a fully qualified KMS key ARN. For more information, see Using encryption for cross-account operations.   For example:    Key ID: 1234abcd-12ab-34cd-56ef-1234567890ab    Key ARN: arn:aws:kms:us-east-2:111122223333:key/1234abcd-12ab-34cd-56ef-1234567890ab     Amazon S3 only supports symmetric KMS keys and not asymmetric KMS keys. For more information, see Using symmetric and asymmetric keys in the Amazon Web Services Key Management Service Developer Guide.
     */
    KMSMasterKeyID?: SSEKMSKeyId
  }
  export interface ServerSideEncryptionConfiguration {
    /**
     * Container for information about a particular server-side encryption configuration rule.
     */
    Rules: ServerSideEncryptionRules
  }
  export interface ServerSideEncryptionRule {
    /**
     * Specifies the default server-side encryption to apply to new objects in the bucket. If a PUT Object request doesn't specify any server-side encryption, this default encryption will be applied.
     */
    ApplyServerSideEncryptionByDefault?: ServerSideEncryptionByDefault
    /**
     * Specifies whether Amazon S3 should use an S3 Bucket Key with server-side encryption using KMS (SSE-KMS) for new objects in the bucket. Existing objects are not affected. Setting the BucketKeyEnabled element to true causes Amazon S3 to use an S3 Bucket Key. By default, S3 Bucket Key is not enabled. For more information, see Amazon S3 Bucket Keys in the Amazon S3 User Guide.
     */
    BucketKeyEnabled?: BucketKeyEnabled
  }
  export type ServerSideEncryptionRules = ServerSideEncryptionRule[]
  export type Setting = boolean
  export type Size = number
  export type SkipValidation = boolean
  export interface SourceSelectionCriteria {
    /**
     *  A container for filter information for the selection of Amazon S3 objects encrypted with Amazon Web Services KMS. If you include SourceSelectionCriteria in the replication configuration, this element is required.
     */
    SseKmsEncryptedObjects?: SseKmsEncryptedObjects
    /**
     * A filter that you can specify for selections for modifications on replicas. Amazon S3 doesn't replicate replica modifications by default. In the latest version of replication configuration (when Filter is specified), you can specify this element and set the status to Enabled to replicate modifications on replicas.    If you don't specify the Filter element, Amazon S3 assumes that the replication configuration is the earlier version, V1. In the earlier version, this element is not allowed
     */
    ReplicaModifications?: ReplicaModifications
  }
  export interface SseKmsEncryptedObjects {
    /**
     * Specifies whether Amazon S3 replicates objects created with server-side encryption using an Amazon Web Services KMS key stored in Amazon Web Services Key Management Service.
     */
    Status: SseKmsEncryptedObjectsStatus
  }
  export type SseKmsEncryptedObjectsStatus = 'Enabled' | 'Disabled' | string
  export type Start = number
  export type StartAfter = string
  export interface Stats {
    /**
     * The total number of object bytes scanned.
     */
    BytesScanned?: BytesScanned
    /**
     * The total number of uncompressed object bytes processed.
     */
    BytesProcessed?: BytesProcessed
    /**
     * The total number of bytes of records payload data returned.
     */
    BytesReturned?: BytesReturned
  }
  export interface StatsEvent {
    /**
     * The Stats event details.
     */
    Details?: Stats
  }
  export type StorageClass =
    | 'STANDARD'
    | 'REDUCED_REDUNDANCY'
    | 'STANDARD_IA'
    | 'ONEZONE_IA'
    | 'INTELLIGENT_TIERING'
    | 'GLACIER'
    | 'DEEP_ARCHIVE'
    | 'OUTPOSTS'
    | 'GLACIER_IR'
    | string
  export interface StorageClassAnalysis {
    /**
     * Specifies how data related to the storage class analysis for an Amazon S3 bucket should be exported.
     */
    DataExport?: StorageClassAnalysisDataExport
  }
  export interface StorageClassAnalysisDataExport {
    /**
     * The version of the output schema to use when exporting data. Must be V_1.
     */
    OutputSchemaVersion: StorageClassAnalysisSchemaVersion
    /**
     * The place to store the data for an analysis.
     */
    Destination: AnalyticsExportDestination
  }
  export type StorageClassAnalysisSchemaVersion = 'V_1' | string
  export type Suffix = string
  export interface Tag {
    /**
     * Name of the object key.
     */
    Key: ObjectKey
    /**
     * Value of the tag.
     */
    Value: Value
  }
  export type TagCount = number
  export type TagSet = Tag[]
  export interface Tagging {
    /**
     * A collection for a set of tags
     */
    TagSet: TagSet
  }
  export type TaggingDirective = 'COPY' | 'REPLACE' | string
  export type TaggingHeader = string
  export type TargetBucket = string
  export interface TargetGrant {
    /**
     * Container for the person being granted permissions.
     */
    Grantee?: Grantee
    /**
     * Logging permissions assigned to the grantee for the bucket.
     */
    Permission?: BucketLogsPermission
  }
  export type TargetGrants = TargetGrant[]
  export type TargetPrefix = string
  export type Tier = 'Standard' | 'Bulk' | 'Expedited' | string
  export interface Tiering {
    /**
     * The number of consecutive days of no access after which an object will be eligible to be transitioned to the corresponding tier. The minimum number of days specified for Archive Access tier must be at least 90 days and Deep Archive Access tier must be at least 180 days. The maximum can be up to 2 years (730 days).
     */
    Days: IntelligentTieringDays
    /**
     * S3 Intelligent-Tiering access tier. See Storage class for automatically optimizing frequently and infrequently accessed objects for a list of access tiers in the S3 Intelligent-Tiering storage class.
     */
    AccessTier: IntelligentTieringAccessTier
  }
  export type TieringList = Tiering[]
  export type Token = string
  export type TopicArn = string
  export interface TopicConfiguration {
    Id?: NotificationId
    /**
     * The Amazon Resource Name (ARN) of the Amazon SNS topic to which Amazon S3 publishes a message when it detects events of the specified type.
     */
    TopicArn: TopicArn
    /**
     * The Amazon S3 bucket event about which to send notifications. For more information, see Supported Event Types in the Amazon S3 User Guide.
     */
    Events: EventList
    Filter?: NotificationConfigurationFilter
  }
  export interface TopicConfigurationDeprecated {
    Id?: NotificationId
    /**
     * A collection of events related to objects
     */
    Events?: EventList
    /**
     * Bucket event for which to send notifications.
     */
    Event?: Event
    /**
     * Amazon SNS topic to which Amazon S3 will publish a message to report the specified events for the bucket.
     */
    Topic?: TopicArn
  }
  export type TopicConfigurationList = TopicConfiguration[]
  export interface Transition {
    /**
     * Indicates when objects are transitioned to the specified storage class. The date value must be in ISO 8601 format. The time is always midnight UTC.
     */
    Date?: _Date
    /**
     * Indicates the number of days after creation when objects are transitioned to the specified storage class. The value must be a positive integer.
     */
    Days?: Days
    /**
     * The storage class to which you want the object to transition.
     */
    StorageClass?: TransitionStorageClass
  }
  export type TransitionList = Transition[]
  export type TransitionStorageClass =
    | 'GLACIER'
    | 'STANDARD_IA'
    | 'ONEZONE_IA'
    | 'INTELLIGENT_TIERING'
    | 'DEEP_ARCHIVE'
    | 'GLACIER_IR'
    | string
  export type Type =
    | 'CanonicalUser'
    | 'AmazonCustomerByEmail'
    | 'Group'
    | string
  export type URI = string
  export type UploadIdMarker = string
  export interface UploadPartCopyOutput {
    /**
     * The version of the source object that was copied, if you have enabled versioning on the source bucket.
     */
    CopySourceVersionId?: CopySourceVersionId
    /**
     * Container for all response elements.
     */
    CopyPartResult?: CopyPartResult
    /**
     * The server-side encryption algorithm used when storing this object in Amazon S3 (for example, AES256, aws:kms).
     */
    ServerSideEncryption?: ServerSideEncryption
    /**
     * If server-side encryption with a customer-provided encryption key was requested, the response will include this header confirming the encryption algorithm used.
     */
    SSECustomerAlgorithm?: SSECustomerAlgorithm
    /**
     * If server-side encryption with a customer-provided encryption key was requested, the response will include this header to provide round-trip message integrity verification of the customer-provided encryption key.
     */
    SSECustomerKeyMD5?: SSECustomerKeyMD5
    /**
     * If present, specifies the ID of the Amazon Web Services Key Management Service (Amazon Web Services KMS) symmetric customer managed key that was used for the object.
     */
    SSEKMSKeyId?: SSEKMSKeyId
    /**
     * Indicates whether the multipart upload uses an S3 Bucket Key for server-side encryption with Amazon Web Services KMS (SSE-KMS).
     */
    BucketKeyEnabled?: BucketKeyEnabled
    RequestCharged?: RequestCharged
  }
  export interface UploadPartCopyRequest {
    /**
     * The bucket name. When using this action with an access point, you must direct requests to the access point hostname. The access point hostname takes the form AccessPointName-AccountId.s3-accesspoint.Region.amazonaws.com. When using this action with an access point through the Amazon Web Services SDKs, you provide the access point ARN in place of the bucket name. For more information about access point ARNs, see Using access points in the Amazon S3 User Guide. When using this action with Amazon S3 on Outposts, you must direct requests to the S3 on Outposts hostname. The S3 on Outposts hostname takes the form  AccessPointName-AccountId.outpostID.s3-outposts.Region.amazonaws.com. When using this action with S3 on Outposts through the Amazon Web Services SDKs, you provide the Outposts bucket ARN in place of the bucket name. For more information about S3 on Outposts ARNs, see Using Amazon S3 on Outposts in the Amazon S3 User Guide.
     */
    Bucket: BucketName
    /**
     * Specifies the source object for the copy operation. You specify the value in one of two formats, depending on whether you want to access the source object through an access point:   For objects not accessed through an access point, specify the name of the source bucket and key of the source object, separated by a slash (/). For example, to copy the object reports/january.pdf from the bucket awsexamplebucket, use awsexamplebucket/reports/january.pdf. The value must be URL-encoded.   For objects accessed through access points, specify the Amazon Resource Name (ARN) of the object as accessed through the access point, in the format arn:aws:s3:&lt;Region&gt;:&lt;account-id&gt;:accesspoint/&lt;access-point-name&gt;/object/&lt;key&gt;. For example, to copy the object reports/january.pdf through access point my-access-point owned by account 123456789012 in Region us-west-2, use the URL encoding of arn:aws:s3:us-west-2:123456789012:accesspoint/my-access-point/object/reports/january.pdf. The value must be URL encoded.  Amazon S3 supports copy operations using access points only when the source and destination buckets are in the same Amazon Web Services Region.  Alternatively, for objects accessed through Amazon S3 on Outposts, specify the ARN of the object as accessed in the format arn:aws:s3-outposts:&lt;Region&gt;:&lt;account-id&gt;:outpost/&lt;outpost-id&gt;/object/&lt;key&gt;. For example, to copy the object reports/january.pdf through outpost my-outpost owned by account 123456789012 in Region us-west-2, use the URL encoding of arn:aws:s3-outposts:us-west-2:123456789012:outpost/my-outpost/object/reports/january.pdf. The value must be URL-encoded.    To copy a specific version of an object, append ?versionId=&lt;version-id&gt; to the value (for example, awsexamplebucket/reports/january.pdf?versionId=QUpfdndhfd8438MNFDN93jdnJFkdmqnh893). If you don't specify a version ID, Amazon S3 copies the latest version of the source object.
     */
    CopySource: CopySource
    /**
     * Copies the object if its entity tag (ETag) matches the specified tag.
     */
    CopySourceIfMatch?: CopySourceIfMatch
    /**
     * Copies the object if it has been modified since the specified time.
     */
    CopySourceIfModifiedSince?: CopySourceIfModifiedSince
    /**
     * Copies the object if its entity tag (ETag) is different than the specified ETag.
     */
    CopySourceIfNoneMatch?: CopySourceIfNoneMatch
    /**
     * Copies the object if it hasn't been modified since the specified time.
     */
    CopySourceIfUnmodifiedSince?: CopySourceIfUnmodifiedSince
    /**
     * The range of bytes to copy from the source object. The range value must use the form bytes=first-last, where the first and last are the zero-based byte offsets to copy. For example, bytes=0-9 indicates that you want to copy the first 10 bytes of the source. You can copy a range only if the source object is greater than 5 MB.
     */
    CopySourceRange?: CopySourceRange
    /**
     * Object key for which the multipart upload was initiated.
     */
    Key: ObjectKey
    /**
     * Part number of part being copied. This is a positive integer between 1 and 10,000.
     */
    PartNumber: PartNumber
    /**
     * Upload ID identifying the multipart upload whose part is being copied.
     */
    UploadId: MultipartUploadId
    /**
     * Specifies the algorithm to use to when encrypting the object (for example, AES256).
     */
    SSECustomerAlgorithm?: SSECustomerAlgorithm
    /**
     * Specifies the customer-provided encryption key for Amazon S3 to use in encrypting data. This value is used to store the object and then it is discarded; Amazon S3 does not store the encryption key. The key must be appropriate for use with the algorithm specified in the x-amz-server-side-encryption-customer-algorithm header. This must be the same encryption key specified in the initiate multipart upload request.
     */
    SSECustomerKey?: SSECustomerKey
    /**
     * Specifies the 128-bit MD5 digest of the encryption key according to RFC 1321. Amazon S3 uses this header for a message integrity check to ensure that the encryption key was transmitted without error.
     */
    SSECustomerKeyMD5?: SSECustomerKeyMD5
    /**
     * Specifies the algorithm to use when decrypting the source object (for example, AES256).
     */
    CopySourceSSECustomerAlgorithm?: CopySourceSSECustomerAlgorithm
    /**
     * Specifies the customer-provided encryption key for Amazon S3 to use to decrypt the source object. The encryption key provided in this header must be one that was used when the source object was created.
     */
    CopySourceSSECustomerKey?: CopySourceSSECustomerKey
    /**
     * Specifies the 128-bit MD5 digest of the encryption key according to RFC 1321. Amazon S3 uses this header for a message integrity check to ensure that the encryption key was transmitted without error.
     */
    CopySourceSSECustomerKeyMD5?: CopySourceSSECustomerKeyMD5
    RequestPayer?: RequestPayer
    /**
     * The account ID of the expected destination bucket owner. If the destination bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
    /**
     * The account ID of the expected source bucket owner. If the source bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedSourceBucketOwner?: AccountId
  }
  export interface UploadPartOutput {
    /**
     * The server-side encryption algorithm used when storing this object in Amazon S3 (for example, AES256, aws:kms).
     */
    ServerSideEncryption?: ServerSideEncryption
    /**
     * Entity tag for the uploaded object.
     */
    ETag?: ETag
    /**
     * The base64-encoded, 32-bit CRC32 checksum of the object. This will only be present if it was uploaded with the object. With multipart uploads, this may not be a checksum value of the object. For more information about how checksums are calculated with multipart uploads, see  Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumCRC32?: ChecksumCRC32
    /**
     * The base64-encoded, 32-bit CRC32C checksum of the object. This will only be present if it was uploaded with the object. With multipart uploads, this may not be a checksum value of the object. For more information about how checksums are calculated with multipart uploads, see  Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumCRC32C?: ChecksumCRC32C
    /**
     * The base64-encoded, 160-bit SHA-1 digest of the object. This will only be present if it was uploaded with the object. With multipart uploads, this may not be a checksum value of the object. For more information about how checksums are calculated with multipart uploads, see  Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumSHA1?: ChecksumSHA1
    /**
     * The base64-encoded, 256-bit SHA-256 digest of the object. This will only be present if it was uploaded with the object. With multipart uploads, this may not be a checksum value of the object. For more information about how checksums are calculated with multipart uploads, see  Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumSHA256?: ChecksumSHA256
    /**
     * If server-side encryption with a customer-provided encryption key was requested, the response will include this header confirming the encryption algorithm used.
     */
    SSECustomerAlgorithm?: SSECustomerAlgorithm
    /**
     * If server-side encryption with a customer-provided encryption key was requested, the response will include this header to provide round-trip message integrity verification of the customer-provided encryption key.
     */
    SSECustomerKeyMD5?: SSECustomerKeyMD5
    /**
     * If present, specifies the ID of the Amazon Web Services Key Management Service (Amazon Web Services KMS) symmetric customer managed key was used for the object.
     */
    SSEKMSKeyId?: SSEKMSKeyId
    /**
     * Indicates whether the multipart upload uses an S3 Bucket Key for server-side encryption with Amazon Web Services KMS (SSE-KMS).
     */
    BucketKeyEnabled?: BucketKeyEnabled
    RequestCharged?: RequestCharged
  }
  export interface UploadPartRequest {
    /**
     * The name of the bucket to which the multipart upload was initiated. When using this action with an access point, you must direct requests to the access point hostname. The access point hostname takes the form AccessPointName-AccountId.s3-accesspoint.Region.amazonaws.com. When using this action with an access point through the Amazon Web Services SDKs, you provide the access point ARN in place of the bucket name. For more information about access point ARNs, see Using access points in the Amazon S3 User Guide. When using this action with Amazon S3 on Outposts, you must direct requests to the S3 on Outposts hostname. The S3 on Outposts hostname takes the form  AccessPointName-AccountId.outpostID.s3-outposts.Region.amazonaws.com. When using this action with S3 on Outposts through the Amazon Web Services SDKs, you provide the Outposts bucket ARN in place of the bucket name. For more information about S3 on Outposts ARNs, see Using Amazon S3 on Outposts in the Amazon S3 User Guide.
     */
    Bucket: BucketName
    /**
     * Size of the body in bytes. This parameter is useful when the size of the body cannot be determined automatically.
     */
    ContentLength?: ContentLength
    /**
     * The base64-encoded 128-bit MD5 digest of the part data. This parameter is auto-populated when using the command from the CLI. This parameter is required if object lock parameters are specified.
     */
    ContentMD5?: ContentMD5
    /**
     * Indicates the algorithm used to create the checksum for the object when using the SDK. This header will not provide any additional functionality if not using the SDK. When sending this header, there must be a corresponding x-amz-checksum or x-amz-trailer header sent. Otherwise, Amazon S3 fails the request with the HTTP status code 400 Bad Request. For more information, see Checking object integrity in the Amazon S3 User Guide. If you provide an individual checksum, Amazon S3 ignores any provided ChecksumAlgorithm parameter. This checksum algorithm must be the same for all parts and it match the checksum value supplied in the CreateMultipartUpload request.
     */
    ChecksumAlgorithm?: ChecksumAlgorithm
    /**
     * This header can be used as a data integrity check to verify that the data received is the same data that was originally sent. This header specifies the base64-encoded, 32-bit CRC32 checksum of the object. For more information, see Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumCRC32?: ChecksumCRC32
    /**
     * This header can be used as a data integrity check to verify that the data received is the same data that was originally sent. This header specifies the base64-encoded, 32-bit CRC32C checksum of the object. For more information, see Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumCRC32C?: ChecksumCRC32C
    /**
     * This header can be used as a data integrity check to verify that the data received is the same data that was originally sent. This header specifies the base64-encoded, 160-bit SHA-1 digest of the object. For more information, see Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumSHA1?: ChecksumSHA1
    /**
     * This header can be used as a data integrity check to verify that the data received is the same data that was originally sent. This header specifies the base64-encoded, 256-bit SHA-256 digest of the object. For more information, see Checking object integrity in the Amazon S3 User Guide.
     */
    ChecksumSHA256?: ChecksumSHA256
    /**
     * Object key for which the multipart upload was initiated.
     */
    Key: ObjectKey
    /**
     * Part number of part being uploaded. This is a positive integer between 1 and 10,000.
     */
    PartNumber: PartNumber
    /**
     * Upload ID identifying the multipart upload whose part is being uploaded.
     */
    UploadId: MultipartUploadId
    /**
     * Specifies the algorithm to use to when encrypting the object (for example, AES256).
     */
    SSECustomerAlgorithm?: SSECustomerAlgorithm
    /**
     * Specifies the customer-provided encryption key for Amazon S3 to use in encrypting data. This value is used to store the object and then it is discarded; Amazon S3 does not store the encryption key. The key must be appropriate for use with the algorithm specified in the x-amz-server-side-encryption-customer-algorithm header. This must be the same encryption key specified in the initiate multipart upload request.
     */
    SSECustomerKey?: SSECustomerKey
    /**
     * Specifies the 128-bit MD5 digest of the encryption key according to RFC 1321. Amazon S3 uses this header for a message integrity check to ensure that the encryption key was transmitted without error.
     */
    SSECustomerKeyMD5?: SSECustomerKeyMD5
    RequestPayer?: RequestPayer
    /**
     * The account ID of the expected bucket owner. If the bucket is owned by a different account, the request fails with the HTTP status code 403 Forbidden (access denied).
     */
    ExpectedBucketOwner?: AccountId
  }
  export type UserMetadata = MetadataEntry[]
  export type Value = string
  export type VersionCount = number
  export type VersionIdMarker = string
  export interface VersioningConfiguration {
    /**
     * Specifies whether MFA delete is enabled in the bucket versioning configuration. This element is only returned if the bucket has been configured with MFA delete. If the bucket has never been so configured, this element is not returned.
     */
    MFADelete?: MFADelete
    /**
     * The versioning state of the bucket.
     */
    Status?: BucketVersioningStatus
  }
  export interface WebsiteConfiguration {
    /**
     * The name of the error document for the website.
     */
    ErrorDocument?: ErrorDocument
    /**
     * The name of the index document for the website.
     */
    IndexDocument?: IndexDocument
    /**
     * The redirect behavior for every request to this bucket's website endpoint.  If you specify this property, you can't specify any other property.
     */
    RedirectAllRequestsTo?: RedirectAllRequestsTo
    /**
     * Rules that define when a redirect is applied and the redirect behavior.
     */
    RoutingRules?: RoutingRules
  }
  export type WebsiteRedirectLocation = string
  export interface WriteGetObjectResponseRequest {
    /**
     * Route prefix to the HTTP URL generated.
     */
    RequestRoute: RequestRoute
    /**
     * A single use encrypted token that maps WriteGetObjectResponse to the end user GetObject request.
     */
    RequestToken: RequestToken
    /**
     * The integer status code for an HTTP response of a corresponding GetObject request.  Status Codes     200 - OK     206 - Partial Content     304 - Not Modified     400 - Bad Request     401 - Unauthorized     403 - Forbidden     404 - Not Found     405 - Method Not Allowed     409 - Conflict     411 - Length Required     412 - Precondition Failed     416 - Range Not Satisfiable     500 - Internal Server Error     503 - Service Unavailable
     */
    StatusCode?: GetObjectResponseStatusCode
    /**
     * A string that uniquely identifies an error condition. Returned in the &lt;Code&gt; tag of the error XML response for a corresponding GetObject call. Cannot be used with a successful StatusCode header or when the transformed object is provided in the body. All error codes from S3 are sentence-cased. The regular expression (regex) value is "^[A-Z][a-zA-Z]+$".
     */
    ErrorCode?: ErrorCode
    /**
     * Contains a generic description of the error condition. Returned in the &lt;Message&gt; tag of the error XML response for a corresponding GetObject call. Cannot be used with a successful StatusCode header or when the transformed object is provided in body.
     */
    ErrorMessage?: ErrorMessage
    /**
     * Indicates that a range of bytes was specified.
     */
    AcceptRanges?: AcceptRanges
    /**
     * Specifies caching behavior along the request/reply chain.
     */
    CacheControl?: CacheControl
    /**
     * Specifies presentational information for the object.
     */
    ContentDisposition?: ContentDisposition
    /**
     * Specifies what content encodings have been applied to the object and thus what decoding mechanisms must be applied to obtain the media-type referenced by the Content-Type header field.
     */
    ContentEncoding?: ContentEncoding
    /**
     * The language the content is in.
     */
    ContentLanguage?: ContentLanguage
    /**
     * The size of the content body in bytes.
     */
    ContentLength?: ContentLength
    /**
     * The portion of the object returned in the response.
     */
    ContentRange?: ContentRange
    /**
     * A standard MIME type describing the format of the object data.
     */
    ContentType?: ContentType
    /**
     * This header can be used as a data integrity check to verify that the data received is the same data that was originally sent. This specifies the base64-encoded, 32-bit CRC32 checksum of the object returned by the Object Lambda function. This may not match the checksum for the object stored in Amazon S3. Amazon S3 will perform validation of the checksum values only when the original GetObject request required checksum validation. For more information about checksums, see Checking object integrity in the Amazon S3 User Guide. Only one checksum header can be specified at a time. If you supply multiple checksum headers, this request will fail.
     */
    ChecksumCRC32?: ChecksumCRC32
    /**
     * This header can be used as a data integrity check to verify that the data received is the same data that was originally sent. This specifies the base64-encoded, 32-bit CRC32C checksum of the object returned by the Object Lambda function. This may not match the checksum for the object stored in Amazon S3. Amazon S3 will perform validation of the checksum values only when the original GetObject request required checksum validation. For more information about checksums, see Checking object integrity in the Amazon S3 User Guide. Only one checksum header can be specified at a time. If you supply multiple checksum headers, this request will fail.
     */
    ChecksumCRC32C?: ChecksumCRC32C
    /**
     * This header can be used as a data integrity check to verify that the data received is the same data that was originally sent. This specifies the base64-encoded, 160-bit SHA-1 digest of the object returned by the Object Lambda function. This may not match the checksum for the object stored in Amazon S3. Amazon S3 will perform validation of the checksum values only when the original GetObject request required checksum validation. For more information about checksums, see Checking object integrity in the Amazon S3 User Guide. Only one checksum header can be specified at a time. If you supply multiple checksum headers, this request will fail.
     */
    ChecksumSHA1?: ChecksumSHA1
    /**
     * This header can be used as a data integrity check to verify that the data received is the same data that was originally sent. This specifies the base64-encoded, 256-bit SHA-256 digest of the object returned by the Object Lambda function. This may not match the checksum for the object stored in Amazon S3. Amazon S3 will perform validation of the checksum values only when the original GetObject request required checksum validation. For more information about checksums, see Checking object integrity in the Amazon S3 User Guide. Only one checksum header can be specified at a time. If you supply multiple checksum headers, this request will fail.
     */
    ChecksumSHA256?: ChecksumSHA256
    /**
     * Specifies whether an object stored in Amazon S3 is (true) or is not (false) a delete marker.
     */
    DeleteMarker?: DeleteMarker
    /**
     * An opaque identifier assigned by a web server to a specific version of a resource found at a URL.
     */
    ETag?: ETag
    /**
     * The date and time at which the object is no longer cacheable.
     */
    Expires?: Expires
    /**
     * If the object expiration is configured (see PUT Bucket lifecycle), the response includes this header. It includes the expiry-date and rule-id key-value pairs that provide the object expiration information. The value of the rule-id is URL-encoded.
     */
    Expiration?: Expiration
    /**
     * The date and time that the object was last modified.
     */
    LastModified?: LastModified
    /**
     * Set to the number of metadata entries not returned in x-amz-meta headers. This can happen if you create metadata using an API like SOAP that supports more flexible metadata than the REST API. For example, using SOAP, you can create metadata whose values are not legal HTTP headers.
     */
    MissingMeta?: MissingMeta
    /**
     * A map of metadata to store with the object in S3.
     */
    Metadata?: Metadata
    /**
     * Indicates whether an object stored in Amazon S3 has Object Lock enabled. For more information about S3 Object Lock, see Object Lock.
     */
    ObjectLockMode?: ObjectLockMode
    /**
     * Indicates whether an object stored in Amazon S3 has an active legal hold.
     */
    ObjectLockLegalHoldStatus?: ObjectLockLegalHoldStatus
    /**
     * The date and time when Object Lock is configured to expire.
     */
    ObjectLockRetainUntilDate?: ObjectLockRetainUntilDate
    /**
     * The count of parts this object has.
     */
    PartsCount?: PartsCount
    /**
     * Indicates if request involves bucket that is either a source or destination in a Replication rule. For more information about S3 Replication, see Replication.
     */
    ReplicationStatus?: ReplicationStatus
    RequestCharged?: RequestCharged
    /**
     * Provides information about object restoration operation and expiration time of the restored object copy.
     */
    Restore?: Restore
    /**
     *  The server-side encryption algorithm used when storing requested object in Amazon S3 (for example, AES256, aws:kms).
     */
    ServerSideEncryption?: ServerSideEncryption
    /**
     * Encryption algorithm used if server-side encryption with a customer-provided encryption key was specified for object stored in Amazon S3.
     */
    SSECustomerAlgorithm?: SSECustomerAlgorithm
    /**
     *  If present, specifies the ID of the Amazon Web Services Key Management Service (Amazon Web Services KMS) symmetric customer managed key that was used for stored in Amazon S3 object.
     */
    SSEKMSKeyId?: SSEKMSKeyId
    /**
     *  128-bit MD5 digest of customer-provided encryption key used in Amazon S3 to encrypt data stored in S3. For more information, see Protecting data using server-side encryption with customer-provided encryption keys (SSE-C).
     */
    SSECustomerKeyMD5?: SSECustomerKeyMD5
    /**
     * Provides storage class information of the object. Amazon S3 returns this header for all objects except for S3 Standard storage class objects. For more information, see Storage Classes.
     */
    StorageClass?: StorageClass
    /**
     * The number of tags, if any, on the object.
     */
    TagCount?: TagCount
    /**
     * An ID used to reference a specific version of the object.
     */
    VersionId?: ObjectVersionId
    /**
     *  Indicates whether the object stored in Amazon S3 uses an S3 bucket key for server-side encryption with Amazon Web Services KMS (SSE-KMS).
     */
    BucketKeyEnabled?: BucketKeyEnabled
  }
  export type Years = number
  /**
   * A string in YYYY-MM-DD format that represents the latest possible API version that can be used in this service. Specify 'latest' to use the latest possible version.
   */
  export type apiVersion = '2006-03-01' | 'latest' | string
}
