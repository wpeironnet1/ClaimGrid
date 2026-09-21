import { Stack } from "expo-router";
import type { ErrorBoundaryProps } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <View accessibilityRole="alert" style={styles.recovery}><Text style={styles.kicker}>CLAIMGRID RECOVERY</Text><Text style={styles.title}>The field view stopped unexpectedly.</Text><Text style={styles.copy}>Saved observations remain on this device. Restart this view; do not clear app storage while evidence still needs to be backed up.</Text><TouchableOpacity accessibilityRole="button" onPress={retry} style={styles.button}><Text style={styles.buttonText}>Restart field companion</Text></TouchableOpacity></View>;
}

export default function Layout(){return <Stack screenOptions={{headerStyle:{backgroundColor:"#172018"},headerTintColor:"#f5f1e7"}}><Stack.Screen name="index" options={{title:"ClaimGrid"}}/><Stack.Screen name="field" options={{title:"Field capture"}}/></Stack>}

const styles=StyleSheet.create({recovery:{flex:1,justifyContent:"center",padding:28,backgroundColor:"#f5f1e7"},kicker:{fontSize:11,letterSpacing:2,color:"#9b583d",fontWeight:"800"},title:{fontFamily:"Georgia",fontSize:38,lineHeight:42,color:"#172018",marginTop:14},copy:{fontSize:15,lineHeight:23,color:"#536055",marginVertical:22},button:{backgroundColor:"#9b583d",borderRadius:8,padding:16,alignItems:"center"},buttonText:{color:"white",fontWeight:"800"}});
