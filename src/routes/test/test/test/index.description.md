<!-- --start-- /test/ -->

# Route Description 
No description Text Provided

## Route Path: 
/test/

## Route Method:
GET




## route Request Headers type definition:
```ts
type RequestHeader = unknown
```

## route Request Params type definition:
```ts
type RequestQueryParams = {
  search: string
}
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



<!-- --end-- /test/ -->

<!-- --start--channel-- /test/ -->

# Channel Description 
No description Text Provided

## Channel Path: 
/test/






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


<!-- --end--channel-- /test/ -->

<!-- --start--event-- test/helloWorld${number} -->

# Event Description 
No description Text Provided

## Event: 
test/helloWorld${number}






## Event Body type definition:
```ts
type EventBody = {
  greeting: string
}
```


## Expected Response Content Type Definition: 
```ts
type ExpectedResponseBody = {
  reply: string;
  yourMom: string
}
```


<!-- --end--event-- test/helloWorld${number} -->

<!-- --start--event-- test/helloWorld2 -->

# Event Description 
No description Text Provided

## Event: 
test/helloWorld2






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


<!-- --end--event-- test/helloWorld2 -->