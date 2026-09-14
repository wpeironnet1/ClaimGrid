import { Stack } from "expo-router";
export default function Layout(){return <Stack screenOptions={{headerStyle:{backgroundColor:"#172018"},headerTintColor:"#f5f1e7"}}><Stack.Screen name="index" options={{title:"ClaimGrid"}}/><Stack.Screen name="field" options={{title:"Field capture"}}/></Stack>}
