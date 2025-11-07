

<!-- --start-- / -->

# Route Description 
No description Text Provided

## Route Path: 
/

## Route Method:
GET




## route Request Headers type definition:
```ts
type RequestHeader = unknown
```

## route Request Params type definition:
```ts
type RequestQueryParams = unknown
```

## route Request Body type definition:
```ts
type RequestBody = {
  name: string;
  age: number
}
```

## Response Content Mimetype: 
application/json

## Response Content Type Definition: 
```ts
type Response = Promise<{
  name: string;
  posts?: undefined | {
  title: string;
  content: string;
  comments: {
  msg: string;
  person: Person;
  replies: {
  msg: string;
  timestamp: string;
  userId: string
}[]
}[]
}[];
  email: string;
  status: "active" | "inactive"
}>
```



<!-- --end-- / -->

<!-- --start--event-- helloWorld -->

# Event Description 
No description Text Provided

## Event: 
helloWorld






## Event Body type definition:
```ts
type EventBody = {
  greeting: string
}
```


## Expected Response Content Type Definition: 
```ts
type ExpectedResponseBody = {
  reply: string
}
```


<!-- --end--event-- helloWorld -->

<!-- --start--event-- helloWorld2 -->

# Event Description 
No description Text Provided

## Event: 
helloWorld2






## Event Body type definition:
```ts
type EventBody = {
  greeting: string
}
```


## Expected Response Content Type Definition: 
```ts
type ExpectedResponseBody = {
  reply: string
}
```


<!-- --end--event-- helloWorld2 -->

<!-- --start--channel-- / -->

# Channel Description 
No description Text Provided

## Channel Path: 
/






## Channel Request Body type definition:
```ts
type RequestBody = {
  name: string;
  age: number
}
```

## Response Content Type Definition: 
```ts
type Response = {
  msg: string
}
```


<!-- --end--channel-- / -->